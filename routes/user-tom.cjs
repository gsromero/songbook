const express = require('express');
const { getDb } = require('../db/database.cjs');

const router = express.Router();

// GET /api/user-tom/:slug
router.get('/:slug', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT tom FROM user_tom WHERE user_id = ? AND musica_slug = ?')
    .get(req.session.userId, req.params.slug);
  res.json({ tom: row?.tom || null });
});

// POST /api/user-tom/:slug
router.post('/:slug', (req, res) => {
  const { tom } = req.body;
  if (!tom) return res.status(400).json({ error: 'Tom é obrigatório' });

  const db = getDb();
  db.prepare(`
    INSERT INTO user_tom (user_id, musica_slug, tom)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, musica_slug) DO UPDATE SET tom = excluded.tom
  `).run(req.session.userId, req.params.slug, tom);

  res.json({ ok: true, tom });
});

module.exports = router;
