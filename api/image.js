'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('./_db');
const { isAdmin } = require('./_auth');

module.exports = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ error: 'Sign in to continue.' });
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const id = req.query.id;
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid submission.' });
    }

    const col = (await getDb()).collection('submissions');
    const doc = await col.findOne({ _id: new ObjectId(id) }, { projection: { image: 1 } });
    if (!doc || !doc.image) return res.status(404).json({ error: 'No image attached.' });

    res.setHeader('Content-Type', doc.image.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    return res.status(200).send(Buffer.from(doc.image.data, 'base64'));
  } catch (err) {
    console.error('image failed:', err);
    return res.status(500).json({ error: 'Something went wrong on our side.' });
  }
};
