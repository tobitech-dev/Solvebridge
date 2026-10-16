'use strict';

const { getDb } = require('./_db');
const { safeEqual, issueCookie, hashIp, requireJson } = require('./_auth');

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!requireJson(req)) {
    return res.status(415).json({ error: 'Send the request as JSON.' });
  }

  try {
    if (!process.env.ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD is not set');
      return res.status(500).json({ error: 'The server is not configured yet.' });
    }

    const attempts = (await getDb()).collection('loginAttempts');
    const ipHash = hashIp(req);

    const failures = await attempts.countDocuments({
      ipHash,
      at: { $gt: new Date(Date.now() - WINDOW_MS) },
    });
    if (failures >= MAX_FAILURES) {
      return res.status(429).json({ error: 'Too many wrong attempts. Wait 15 minutes and try again.' });
    }

    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';

    if (password && safeEqual(password, process.env.ADMIN_PASSWORD)) {
      await attempts.deleteMany({ ipHash });
      issueCookie(res);
      return res.status(200).json({ ok: true });
    }

    await attempts.insertOne({ ipHash, at: new Date() });
    await sleep(600); // slows down guessing
    return res.status(401).json({ error: 'That password is incorrect.' });
  } catch (err) {
    console.error('login failed:', err);
    return res.status(500).json({ error: 'Something went wrong on our side. Try again in a moment.' });
  }
};
