const express = require('express');
const { searchCifraClub, fetchCifra } = require('../services/cifraclub.cjs');
const { suggestTags } = require('../services/gemini.cjs');

const router = express.Router();

// GET /api/cifraclub/search?q=
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parâmetro q obrigatório' });

  try {
    const results = await searchCifraClub(q);
    res.json(results);
  } catch (err) {
    console.error('[cifraclub] search error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar no CifraClub: ' + err.message });
  }
});

// GET /api/cifraclub/fetch?url=
router.get('/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Parâmetro url obrigatório' });

  try {
    const cifraData = await fetchCifra(url);

    // Sugerir tags com Gemini (em paralelo, não bloqueia)
    const tags = await suggestTags(cifraData.titulo, cifraData.artista, cifraData.cifra)
      .catch(() => []);

    res.json({ ...cifraData, tags_sugeridas: tags });
  } catch (err) {
    console.error('[cifraclub] fetch error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar cifra: ' + err.message });
  }
});

module.exports = router;
