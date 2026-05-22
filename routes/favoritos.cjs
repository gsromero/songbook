const express = require('express');
const { getDb } = require('../db/database.cjs');

const router = express.Router();

// GET /api/favoritos — slugs das músicas favoritadas pelo usuário
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT musica_slug FROM favoritos WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId);
  res.json(rows.map(r => r.musica_slug));
});

// POST /api/favoritos/:slug — adicionar favorito
router.post('/:slug', (req, res) => {
  const db = getDb();
  try {
    db.prepare('INSERT OR IGNORE INTO favoritos (user_id, musica_slug) VALUES (?, ?)')
      .run(req.session.userId, req.params.slug);
    res.json({ ok: true, favorito: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/favoritos/:slug — remover favorito
router.delete('/:slug', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM favoritos WHERE user_id = ? AND musica_slug = ?')
    .run(req.session.userId, req.params.slug);
  res.json({ ok: true, favorito: false });
});

module.exports = router;
