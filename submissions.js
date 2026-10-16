'use strict';

const { ObjectId } = require('mongodb');
const { getDb } = require('./_db');
const { isAdmin, requireJson } = require('./_auth');

const STATUSES = ['new', 'reviewed', 'solved'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Sign in to continue.' });

    const col = (await getDb()).collection('submissions');

    if (req.method === 'GET') {
      const status = String(req.query.status || 'all');
      const q = String(req.query.q || '').trim().slice(0, 100);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);

      const filter = {};
      if (STATUSES.includes(status)) filter.status = status;
      if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ name: rx }, { email: rx }, { country: rx }, { problem: rx }];
      }

      const [total, docs, grouped] = await Promise.all([
        col.countDocuments(filter),
        col
          .find(filter, { projection: { image: 0, ipHash: 0 } })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        col.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
      ]);

      const counts = { all: 0, new: 0, reviewed: 0, solved: 0 };
      grouped.forEach((g) => {
        if (g._id in counts) counts[g._id] = g.n;
        counts.all += g.n;
      });

      return res.status(200).json({
        items: docs.map((d) => ({
          _id: String(d._id),
          name: d.name,
          email: d.email,
          country: d.country,
          problem: d.problem,
          status: d.status,
          hasImage: Boolean(d.hasImage),
          createdAt: d.createdAt,
        })),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        counts,
      });
    }

    if (req.method === 'PATCH') {
      if (!requireJson(req)) return res.status(415).json({ error: 'Send the request as JSON.' });
      const { id, status } = req.body || {};
      if (!validId(id) || !STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid submission or status.' });
      }
      const result = await col.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
      if (!result.matchedCount) return res.status(404).json({ error: 'Submission not found.' });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!validId(id)) return res.status(400).json({ error: 'Invalid submission.' });
      const result = await col.deleteOne({ _id: new ObjectId(id) });
      if (!result.deletedCount) return res.status(404).json({ error: 'Submission not found.' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('submissions failed:', err);
    return res.status(500).json({ error: 'Something went wrong on our side.' });
  }
};
