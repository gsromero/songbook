const cheerio = require('cheerio');

const BASE_URL = 'https://www.cifraclub.com.br';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

async function searchCifraClub(query) {
  const url = `${BASE_URL}/busca/?q=${encodeURIComponent(query)}&tipo=cifras`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`CifraClub busca falhou: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  // Seletores da página de busca do CifraClub
  $('article.gs-result, .gs-result, ul.results li, .search-result-item').each((i, el) => {
    if (results.length >= 10) return false;
    const $el = $(el);

    // Tenta diferentes seletores para título e artista
    const titulo = $el.find('b, .art_name, h2, .song-name').first().text().trim()
      || $el.find('a').first().text().trim();
    const artista = $el.find('span.sub, .artist-name, small').first().text().trim();
    const href = $el.find('a').first().attr('href');

    if (titulo && href) {
      const songUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      results.push({ titulo, artista: artista || '', url: songUrl });
    }
  });

  // Fallback: tenta pegar links da busca do Google embutida
  if (results.length === 0) {
    $('a[href*="cifraclub.com.br"]').each((i, el) => {
      if (results.length >= 10) return false;
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      if (href && text && href.includes('/cifraclub.com.br/') && text.length > 3) {
        results.push({ titulo: text, artista: '', url: href });
      }
    });
  }

  return results;
}

async function fetchCifra(cifraUrl) {
  // Garantir URL completa
  const url = cifraUrl.startsWith('http') ? cifraUrl : `${BASE_URL}${cifraUrl}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`CifraClub fetch falhou: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Título e artista
  const titulo = $('h1.t1').text().trim()
    || $('h1').first().text().trim()
    || '';
  const artista = $('h2.t3 a, .artist-name a, h2 a').first().text().trim()
    || $('h2').first().text().trim()
    || '';

  // Tom original
  const tomOriginalText = $('select#cifra_tom option[selected], .tone-select option[selected], [data-original-key]')
    .first().text().trim()
    || $('b:contains("Tom:")').parent().text().replace('Tom:', '').trim()
    || '';
  const tomOriginal = tomOriginalText.match(/^[A-G][b#]?m?/)?.[0] || '';

  // Cifra — o conteúdo está em <pre> com classe específica
  let cifra = '';
  const preEl = $('pre.cifra, #cifra_content pre, .cifra-content pre, pre').first();

  if (preEl.length) {
    // Extrair texto preservando quebras de linha
    cifra = preEl.text().trim();
  }

  // Se não encontrou cifra, tenta extrair de spans com classe de acordes
  if (!cifra) {
    const cifraDiv = $('#cifra_content, .cifra-content, .tab-content').first();
    if (cifraDiv.length) {
      // Converter HTML em texto preservando estrutura de chord-over-words
      cifraDiv.find('a.acorde, .chord').each((_, el) => {
        $(el).replaceWith(`${$(el).text()} `);
      });
      cifra = cifraDiv.text().trim();
    }
  }

  if (!cifra) {
    throw new Error('Não foi possível extrair a cifra desta página');
  }

  // Limpar cifra: remover propagandas, links de compra etc
  cifra = cifra
    .replace(/\[tab\]|\[\/tab\]/gi, '')
    .replace(/Aprenda a tocar.*/gi, '')
    .replace(/Tom:.*/gi, '')
    .trim();

  return { titulo, artista, tomOriginal, cifra, url };
}

module.exports = { searchCifraClub, fetchCifra };
