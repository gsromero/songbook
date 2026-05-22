const express = require('express');
const { getDb } = require('../db/database.cjs');

const router = express.Router();

// GET /api/historico — últimas 10 músicas acessadas pelo usuário (sem duplicatas)
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT h.musica_slug, MAX(h.acessado_em) as acessado_em,
      m.titulo, m.artista, m.tags
    FROM historico h
    JOIN musicas m ON m.slug = h.musica_slug
    WHERE h.user_id = ?
    GROUP BY h.musica_slug
    ORDER BY acessado_em DESC
    LIMIT 10
  `).all(req.session.userId);

  res.json(rows.map(r => ({
    slug: r.musica_slug,
    titulo: r.titulo,
    artista: r.artista,
    tags: JSON.parse(r.tags || '[]'),
    acessado_em: r.acessado_em,
  })));
});

module.exports = router;
