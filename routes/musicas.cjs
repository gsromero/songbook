const express = require('express');
const { getDb } = require('../db/database.cjs');
const { extractChordsFromCifra, generateChordSVGs } = require('../services/chords.cjs');

const router = express.Router();

function parseMusica(row, userId) {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    chord_svgs: JSON.parse(row.chord_svgs || '{}'),
    favorito: Boolean(row.favorito),
    user_tom: row.user_tom || null,
    user_transpose: row.user_transpose ?? 0,
  };
}

// GET /api/musicas — lista todas as músicas com favoritos e tom do usuário
router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.session.userId;

  const rows = db.prepare(`
    SELECT m.*,
      CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as favorito,
      ut.tom as user_tom,
      utr.offset as user_transpose
    FROM musicas m
    LEFT JOIN favoritos f ON f.musica_slug = m.slug AND f.user_id = ?
    LEFT JOIN user_tom ut ON ut.musica_slug = m.slug AND ut.user_id = ?
    LEFT JOIN user_transpose utr ON utr.musica_slug = m.slug AND utr.user_id = ?
    ORDER BY m.created_at DESC
  `).all(userId, userId, userId);

  // Para a listagem, não enviar cifra e chord_svgs (dados pesados)
  const musicas = rows.map(row => ({
    slug: row.slug,
    titulo: row.titulo,
    artista: row.artista,
    tom: row.user_tom || row.tom,
    tom_original: row.tom_original,
    tags: JSON.parse(row.tags || '[]'),
    link_youtube: row.link_youtube,
    link_cifraclub: row.link_cifraclub,
    adicionado_por: row.adicionado_por,
    created_at: row.created_at,
    favorito: Boolean(row.favorito),
  }));

  res.json(musicas);
});

// GET /api/musicas/:slug — detalhes completos de uma música
router.get('/:slug', (req, res) => {
  const db = getDb();
  const userId = req.session.userId;
  const { slug } = req.params;

  const row = db.prepare(`
    SELECT m.*,
      CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as favorito,
      ut.tom as user_tom,
      utr.offset as user_transpose,
      u.username as adicionado_por_username
    FROM musicas m
    LEFT JOIN favoritos f ON f.musica_slug = m.slug AND f.user_id = ?
    LEFT JOIN user_tom ut ON ut.musica_slug = m.slug AND ut.user_id = ?
    LEFT JOIN user_transpose utr ON utr.musica_slug = m.slug AND utr.user_id = ?
    LEFT JOIN users u ON u.id = m.adicionado_por
    WHERE m.slug = ?
  `).get(userId, userId, userId, slug);

  if (!row) return res.status(404).json({ error: 'Música não encontrada' });

  // Registrar no histórico
  db.prepare(`
    INSERT INTO historico (user_id, musica_slug) VALUES (?, ?)
  `).run(userId, slug);

  res.json(parseMusica(row, userId));
});

// GET /api/musicas/:slug/similares
router.get('/:slug/similares', (req, res) => {
  const db = getDb();
  const userId = req.session.userId;
  const { slug } = req.params;

  const musica = db.prepare('SELECT * FROM musicas WHERE slug = ?').get(slug);
  if (!musica) return res.json([]);

  const tags = JSON.parse(musica.tags || '[]');
  const all = db.prepare(`
    SELECT m.*, CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as favorito
    FROM musicas m
    LEFT JOIN favoritos f ON f.musica_slug = m.slug AND f.user_id = ?
    WHERE m.slug != ?
  `).all(userId, slug);

  const scored = all.map(row => {
    const rowTags = JSON.parse(row.tags || '[]');
    const commonTags = rowTags.filter(t => tags.includes(t)).length;
    const sameArtist = row.artista === musica.artista ? 2 : 0;
    return { row, score: commonTags + sameArtist };
  })
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ row }) => ({
      slug: row.slug,
      titulo: row.titulo,
      artista: row.artista,
      tags: JSON.parse(row.tags || '[]'),
      favorito: Boolean(row.favorito),
    }));

  res.json(scored);
});

// POST /api/musicas — adicionar nova música
router.post('/', (req, res) => {
  const db = getDb();
  const userId = req.session.userId;
  const { titulo, artista, tom, tom_original, tags, cifra, link_cifraclub, link_youtube } = req.body;

  if (!titulo || !artista || !cifra) {
    return res.status(400).json({ error: 'Título, artista e cifra são obrigatórios' });
  }

  // Gerar slug
  const slug = `${titulo}-${artista}`
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Verificar duplicata
  const existing = db.prepare('SELECT slug FROM musicas WHERE slug = ?').get(slug);
  if (existing) return res.status(409).json({ error: 'Música já existe', slug: existing.slug });

  // Gerar SVGs dos acordes
  const chords = extractChordsFromCifra(cifra);
  const chordSvgs = generateChordSVGs(chords);

  db.prepare(`
    INSERT INTO musicas (slug, titulo, artista, tom, tom_original, tags, cifra, chord_svgs, link_cifraclub, link_youtube, adicionado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    slug, titulo, artista,
    tom || null,
    tom_original || null,
    JSON.stringify(tags || []),
    cifra,
    JSON.stringify(chordSvgs),
    link_cifraclub || '',
    link_youtube || '',
    userId
  );

  res.json({ ok: true, slug });
});

module.exports = router;
