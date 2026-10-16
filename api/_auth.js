'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const COOKIE = 'sb_admin';
const SESSION_SECONDS = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of 32+ characters');
  }
  return s;
}

// Compare two strings without leaking length or content through timing.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function issueCookie(res) {
  const token = jwt.sign({ role: 'admin' }, secret(), { expiresIn: SESSION_SECONDS });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`
  );
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function isAdmin(req) {
  const key = secret(); // throws if misconfigured, so the problem is visible
  const token = parseCookies(req)[COOKIE];
  if (!token) return false;
  try {
    return jwt.verify(token, key).role === 'admin';
  } catch {
    return false;
  }
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Store a keyed hash of the IP, never the IP itself.
function hashIp(req) {
  return crypto.createHmac('sha256', secret()).update(String(clientIp(req))).digest('hex');
}

// Extra CSRF protection: browsers cannot send JSON cross-site without a CORS preflight.
function requireJson(req) {
  return String(req.headers['content-type'] || '').toLowerCase().includes('application/json');
}

module.exports = { safeEqual, issueCookie, clearCookie, isAdmin, hashIp, requireJson };
