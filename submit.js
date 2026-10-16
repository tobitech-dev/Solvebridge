'use strict';

const { getDb } = require('./_db');
const { hashIp, requireJson } = require('./_auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_IMAGE_B64 = 2500000; // about 1.8 MB of image data
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PER_HOUR = 5;

// Remove control characters but keep tabs and line breaks.
function text(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

function checkImage(image) {
  if (image == null) return { ok: true, image: null };
  if (typeof image !== 'object') return { ok: false };

  const { mime, data } = image;
  if (!ALLOWED_MIME.includes(mime)) return { ok: false };
  if (typeof data !== 'string' || !data.length || data.length > MAX_IMAGE_B64) return { ok: false };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { ok: false };

  // Confirm the bytes really are the claimed image type.
  const head = Buffer.from(data.slice(0, 32), 'base64');
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head.slice(1, 4).toString('ascii') === 'PNG';
  const isWebp =
    head.slice(0, 4).toString('ascii') === 'RIFF' && head.slice(8, 12).toString('ascii') === 'WEBP';
  const matches =
    (mime === 'image/jpeg' && isJpeg) ||
    (mime === 'image/png' && isPng) ||
    (mime === 'image/webp' && isWebp);
  if (!matches) return { ok: false };

  return { ok: true, image: { mime, data } };
}

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
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Bots fill the hidden field. Pretend it worked and store nothing.
    if (text(body.website)) return res.status(200).json({ ok: true });

    const name = text(body.name);
    const email = text(body.email).toLowerCase();
    const country = text(body.country);
    const problem = text(body.problem);

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Enter your full name (2 to 100 characters).' });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (country.length < 2 || country.length > 80) {
      return res.status(400).json({ error: 'Choose your country.' });
    }
    if (problem.length < 20) {
      return res.status(400).json({ error: 'Describe the problem in at least 20 characters.' });
    }
    if (problem.length > 5000) {
      return res.status(400).json({ error: 'Shorten the problem to 5000 characters or fewer.' });
    }

    const checked = checkImage(body.image);
    if (!checked.ok) {
      return res.status(400).json({ error: 'The image must be a JPG, PNG or WebP under about 1.8 MB.' });
    }

    const db = await getDb();
    const submissions = db.collection('submissions');
    const ipHash = hashIp(req);

    const recent = await submissions.countDocuments({
      ipHash,
      createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recent >= MAX_PER_HOUR) {
      return res.status(429).json({ error: 'You have sent several problems recently. Try again in an hour.' });
    }

    await submissions.insertOne({
      name,
      email,
      country,
      problem,
      image: checked.image,
      hasImage: Boolean(checked.image),
      status: 'new',
      createdAt: new Date(),
      ipHash,
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('submit failed:', err);
    return res.status(500).json({ error: 'Something went wrong on our side. Try again in a moment.' });
  }
};
