const cheerio = require('cheerio');

const CC_BASE = 'https://www.cifraclub.com.br';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function toName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── Busca via Startpage (proxy do Google) ──────────────────────────────────────

async function searchCifraClub(query) {
  const q = encodeURIComponent(`${query} cifraclub.com.br`);
  const url = `https://www.startpage.com/sp/search?q=${q}&language=pt-BR`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Startpage falhou: ${res.status}`);

  const html = await res.text();

  // Extrair links do CifraClub no formato /artista/musica/
  const links = [
    ...html.matchAll(/href="(https:\/\/www\.cifraclub\.com\.br\/[a-z0-9][a-z0-9\-]+\/[a-z0-9][a-z0-9\-]+\/)"/g),
  ]
    .map(m => m[1])
    .filter(l =>
      !l.includes('/busca') &&
      !l.includes('/estilos') &&
      !l.includes('/blog') &&
      !l.includes('/cadastro') &&
      !l.includes('/login')
    );

  const seen = new Set();
  const results = [];

  for (const songUrl of links) {
    if (seen.has(songUrl)) continue;
    seen.add(songUrl);

    const parts = songUrl
      .replace(`${CC_BASE}/`, '')
      .replace(/\/$/, '')
      .split('/');

    if (parts.length !== 2) continue;

    const [artistSlug, songSlug] = parts;
    results.push({
      titulo: toName(songSlug),
      artista: toName(artistSlug),
      url: songUrl,
    });

    if (results.length >= 10) break;
  }

  return results;
}

// ── Fetch da cifra de uma URL específica ────────────────────────────────────────

async function fetchCifra(cifraUrl) {
  const url = cifraUrl.startsWith('http') ? cifraUrl : `${CC_BASE}${cifraUrl}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`CifraClub fetch falhou: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Título e artista — seletores específicos do CifraClub
  const titulo = $('h1.t1').first().text().trim() || $('h1').eq(1).text().trim();
  const artista = $('h2.t3 a').first().text().trim() || $('h2').first().text().trim();

  // Tom original — o link "alterar o tom da cifra"
  const tomText = $('a[title="alterar o tom da cifra"]').first().text().trim();
  const tomOriginal = tomText.match(/^[A-G][b#]?(?:m\b)?/)?.[0] || '';

  // Cifra: está no <pre>; acordes em <b>, tablatura em .tablatura/.cnt a remover
  let cifra = '';
  const preEl = $('pre').first();

  if (preEl.length) {
    // Remover seções de tablatura
    preEl.find('.tablatura, .cnt, .tab').each((_, el) => $(el).remove());
    // Substituir <b>ACORDE</b> por ACORDE
    preEl.find('b').each((_, el) => $(el).replaceWith($(el).text()));
    cifra = preEl.text().trim();
  }

  if (!cifra) throw new Error('Não foi possível extrair a cifra desta página');

  // Limpar cifra
  cifra = cifra
    .replace(/\[tab\]|\[\/tab\]/gi, '')
    .replace(/\r/g, '')
    .trim();

  return { titulo, artista, tomOriginal, cifra, url };
}

module.exports = { searchCifraClub, fetchCifra };
