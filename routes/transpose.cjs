const express = require('express');
const { getDb } = require('../db/database.cjs');

const router = express.Router();

// GET /api/transpose/:slug
router.get('/:slug', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT offset FROM user_transpose WHERE user_id = ? AND musica_slug = ?')
    .get(req.session.userId, req.params.slug);
  res.json({ offset: row?.offset ?? 0 });
});

// POST /api/transpose/:slug
router.post('/:slug', (req, res) => {
  const offset = parseInt(req.body.offset ?? 0, 10);
  const db = getDb();
  db.prepare(`
    INSERT INTO user_transpose (user_id, musica_slug, offset)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, musica_slug) DO UPDATE SET offset = excluded.offset
  `).run(req.session.userId, req.params.slug, offset);
  res.json({ ok: true, offset });
});

module.exports = router;
