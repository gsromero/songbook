import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import * as cheerio from 'cheerio';
import guitarDb from '@tombatossals/chords-db/lib/guitar.json';

const app = new Hono().basePath('/api');

const TAGS_DISPONIVEIS = [
  'mpb',
  'rock',
  'samba',
  'pagode',
  'jazz',
  'bossa',
  'forro',
  'sertanejo',
  'pop',
  'latin',
  'indie',
  'instrumental',
  'fingerstyle',
  'dedilhado-simples',
  'balada',
  'gospel',
  'reggae',
];

const CC_BASE = 'https://www.cifraclub.com.br';
const SCRAPE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

const STRINGS = 6;
const FRETS = 4;
const SS = 14;
const FS = 18;
const GL = 18;
const GT = 40;
const DR = 5;
const W = GL + SS * (STRINGS - 1) + 22;
const H = GT + FS * FRETS + 16;

const ROOT_MAP = {
  C: 'C',
  'C#': 'Csharp',
  Db: 'Csharp',
  D: 'D',
  'D#': 'Eb',
  Eb: 'Eb',
  E: 'E',
  Fb: 'E',
  F: 'F',
  'F#': 'Fsharp',
  Gb: 'Fsharp',
  G: 'G',
  'G#': 'Ab',
  Ab: 'Ab',
  A: 'A',
  'A#': 'Bb',
  Bb: 'Bb',
  B: 'B',
  Cb: 'B',
};

const SUFFIX_MAP = {
  '': 'major',
  maj: 'major',
  m: 'minor',
  min: 'minor',
  '7': '7',
  m7: 'm7',
  maj7: 'maj7',
  M7: 'maj7',
  '7M': 'maj7',
  Maj7: 'maj7',
  '9': '9',
  m9: 'm9',
  maj9: 'maj9',
  add9: 'add9',
  '11': '11',
  '13': '13',
  dim: 'dim',
  dim7: 'dim7',
  aug: 'aug',
  '+': 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
  '4': 'sus4',
  m7b5: 'm7b5',
  '6': '6',
  m6: 'm6',
  '5': '5',
  '7sus4': '7sus4',
};

function jsonError(c, status, error) {
  return c.json({ error }, status, { 'Cache-Control': 'no-store' });
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

async function readJson(c) {
  return c.req.json().catch(() => ({}));
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(titulo, artista) {
  return `${titulo}-${artista}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderChordSVG(name, pos) {
  const parts = [];

  parts.push(
    `<text x="${W / 2}" y="13" text-anchor="middle" font-size="11" font-weight="bold" font-family="sans-serif" fill="currentColor">${esc(name)}</text>`,
  );

  const nutW = pos.baseFret === 1 ? 4 : 1.5;
  parts.push(
    `<line x1="${GL}" y1="${GT}" x2="${GL + SS * (STRINGS - 1)}" y2="${GT}" stroke="currentColor" stroke-width="${nutW}" stroke-linecap="round"/>`,
  );

  if (pos.baseFret > 1) {
    parts.push(
      `<text x="${GL + SS * (STRINGS - 1) + 5}" y="${GT + FS * 0.65}" font-size="9" font-family="sans-serif" fill="currentColor" fill-opacity="0.7">${pos.baseFret}fr</text>`,
    );
  }

  for (let f = 1; f <= FRETS; f++) {
    const y = GT + f * FS;
    parts.push(
      `<line x1="${GL}" y1="${y}" x2="${GL + SS * (STRINGS - 1)}" y2="${y}" stroke="currentColor" stroke-opacity="0.35" stroke-width="1"/>`,
    );
  }

  for (let s = 0; s < STRINGS; s++) {
    const x = GL + s * SS;
    parts.push(
      `<line x1="${x}" y1="${GT}" x2="${x}" y2="${GT + FS * FRETS}" stroke="currentColor" stroke-opacity="0.55" stroke-width="1"/>`,
    );
  }

  for (let s = 0; s < STRINGS; s++) {
    const x = GL + s * SS;
    const fret = pos.frets[s];
    if (fret === -1) {
      parts.push(
        `<text x="${x}" y="${GT - 6}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.55">x</text>`,
      );
    } else if (fret === 0) {
      parts.push(
        `<circle cx="${x}" cy="${GT - 9}" r="4" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5"/>`,
      );
    }
  }

  for (const barre of pos.barres || []) {
    const row = barre - 1;
    const y = GT + row * FS + FS / 2;
    const barreStrings = pos.frets.map((f, i) => ({ f, i })).filter(({ f }) => f === barre);
    if (barreStrings.length >= 2) {
      const x1 = GL + barreStrings[0].i * SS;
      const x2 = GL + barreStrings[barreStrings.length - 1].i * SS;
      parts.push(`<rect x="${x1 - DR}" y="${y - DR}" width="${x2 - x1 + DR * 2}" height="${DR * 2}" rx="${DR}" fill="currentColor"/>`);
    }
  }

  for (let s = 0; s < STRINGS; s++) {
    const fret = pos.frets[s];
    if (fret > 0 && !(pos.barres || []).includes(fret)) {
      const row = fret - 1;
      const x = GL + s * SS;
      const y = GT + row * FS + FS / 2;
      parts.push(`<circle cx="${x}" cy="${y}" r="${DR}" fill="currentColor"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Diagrama de ${esc(name)}">${parts.join('')}</svg>`;
}

function parseChordName(raw) {
  const match = raw.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!match) return null;
  const dbKey = ROOT_MAP[match[1]];
  if (!dbKey) return null;
  const suffix = (match[2] || '').trim();
  return { dbKey, suffix: SUFFIX_MAP[suffix] || suffix };
}

function extractChordsFromCifra(cifraText) {
  const chordPattern = /\b([A-G][b#]?(?:maj|min|m|dim|aug|sus)?[0-9]*[Mm]?(?:[b#][0-9])?)\b/g;
  const chords = new Set();

  for (const line of String(cifraText || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('<!--')) continue;
    const words = trimmed.split(/\s+/);
    const chordCount = words.filter((word) => /^[A-G][b#]?/.test(word)).length;
    if (chordCount > 0 && chordCount >= words.length * 0.5) {
      let match;
      const re = new RegExp(chordPattern.source, 'g');
      while ((match = re.exec(trimmed)) !== null) {
        chords.add(match[1]);
      }
    }
  }

  return Array.from(chords);
}

function generateChordSVGs(chordNames) {
  const result = {};

  for (const chord of chordNames) {
    const parsed = parseChordName(chord);
    if (!parsed) continue;

    const group = guitarDb.chords[parsed.dbKey];
    if (!group) continue;

    const entry = group.find((item) => item.suffix === parsed.suffix);
    if (!entry || !entry.positions.length) continue;

    result[chord] = renderChordSVG(chord, entry.positions[0]);
  }

  return result;
}

function parseMusica(row) {
  return {
    ...row,
    tags: safeJsonParse(row.tags, []),
    chord_svgs: safeJsonParse(row.chord_svgs, {}),
    favorito: Boolean(row.favorito),
    user_tom: row.user_tom || null,
    user_transpose: row.user_transpose ?? 0,
  };
}

async function getMusicaBySlug(c, userId, slug) {
  const row = await c.env.DB.prepare(
    `
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
  `,
  )
    .bind(userId, userId, userId, slug)
    .first();

  return row ? parseMusica(row) : null;
}

function toName(slug) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function searchCifraClub(query) {
  const q = encodeURIComponent(`${query} cifraclub.com.br`);
  const url = `https://www.startpage.com/sp/search?q=${q}&language=pt-BR`;
  const res = await fetch(url, { headers: SCRAPE_HEADERS });
  if (!res.ok) throw new Error(`Startpage falhou: ${res.status}`);

  const html = await res.text();
  const links = [...html.matchAll(/href="(https:\/\/www\.cifraclub\.com\.br\/[a-z0-9][a-z0-9-]+\/[a-z0-9][a-z0-9-]+\/)"/g)]
    .map((match) => match[1])
    .filter(
      (link) =>
        !link.includes('/busca') &&
        !link.includes('/estilos') &&
        !link.includes('/blog') &&
        !link.includes('/cadastro') &&
        !link.includes('/login'),
    );

  const seen = new Set();
  const results = [];

  for (const songUrl of links) {
    if (seen.has(songUrl)) continue;
    seen.add(songUrl);

    const parts = songUrl.replace(`${CC_BASE}/`, '').replace(/\/$/, '').split('/');
    if (parts.length !== 2) continue;

    results.push({
      titulo: toName(parts[1]),
      artista: toName(parts[0]),
      url: songUrl,
    });

    if (results.length >= 10) break;
  }

  return results;
}

async function fetchCifra(cifraUrl) {
  const url = cifraUrl.startsWith('http') ? cifraUrl : `${CC_BASE}${cifraUrl}`;
  const res = await fetch(url, { headers: SCRAPE_HEADERS });
  if (!res.ok) throw new Error(`CifraClub fetch falhou: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const titulo = $('h1.t1').first().text().trim() || $('h1').eq(1).text().trim();
  const artista = $('h2.t3 a').first().text().trim() || $('h2').first().text().trim();
  const tomText = $('a[title="alterar o tom da cifra"]').first().text().trim();
  const tomOriginal = tomText.match(/^[A-G][b#]?(?:m\b)?/)?.[0] || '';
  const preEl = $('pre').first();
  let cifra = '';

  if (preEl.length) {
    preEl.find('.tablatura, .cnt, .tab').each((_, el) => $(el).remove());
    preEl.find('b').each((_, el) => $(el).replaceWith($(el).text()));
    cifra = preEl.text().trim();
  }

  if (!cifra) throw new Error('Nao foi possivel extrair a cifra desta pagina');

  cifra = cifra.replace(/\[tab\]|\[\/tab\]/gi, '').replace(/\r/g, '').trim();
  return { titulo, artista, tomOriginal, cifra, url };
}

async function suggestTags(env, titulo, artista, cifraExcerpt) {
  const apiKey = (env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return [];

  const prompt = `Voce e um assistente especialista em musica brasileira e internacional.

Analise esta musica e sugira tags do estilo/genero:

Titulo: ${titulo}
Artista: ${artista}
Trecho da cifra:
${String(cifraExcerpt || '').slice(0, 500)}

Tags disponiveis: ${TAGS_DISPONIVEIS.join(', ')}

Responda APENAS com um array JSON com 1 a 4 tags mais relevantes, sem explicacao.
Exemplo: ["mpb", "dedilhado-simples"]`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const match = text.match(/\[.*?\]/s);
    if (!match) return [];
    const tags = JSON.parse(match[0]);
    return tags.filter((tag) => TAGS_DISPONIVEIS.includes(tag));
  } catch {
    return [];
  }
}

async function makeToken(user, secret) {
  return new SignJWT({ uid: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(secret));
}

async function auth(c, next) {
  const token = getCookie(c, 'token');
  const secret = (c.env.JWT_SECRET || '').trim();
  if (!token) return jsonError(c, 401, 'Nao autenticado');
  if (!secret) return jsonError(c, 500, 'JWT_SECRET nao configurado');

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    c.set('userId', payload.uid);
    c.set('username', payload.username);
    await next();
  } catch {
    return jsonError(c, 401, 'Token invalido');
  }
}

app.use('*', async (c, next) => {
  if (new URL(c.req.url).pathname.startsWith('/api/auth/')) return next();
  return auth(c, next);
});

app.post('/auth/login', async (c) => {
  const { username, password } = await readJson(c);
  if (!username || !password) return jsonError(c, 400, 'Username e senha sao obrigatorios');

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return jsonError(c, 401, 'Credenciais invalidas');
  }

  const token = await makeToken(user, (c.env.JWT_SECRET || '').trim());
  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ ok: true, username: user.username, user: { id: user.id, username: user.username } });
});

app.post('/auth/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

app.get('/auth/me', auth, async (c) => {
  const user = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(c.get('userId')).first();
  return user ? c.json(user) : jsonError(c, 404, 'Usuario nao encontrado');
});

app.get('/musicas', async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    `
    SELECT m.*,
      CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as favorito,
      ut.tom as user_tom,
      utr.offset as user_transpose
    FROM musicas m
    LEFT JOIN favoritos f ON f.musica_slug = m.slug AND f.user_id = ?
    LEFT JOIN user_tom ut ON ut.musica_slug = m.slug AND ut.user_id = ?
    LEFT JOIN user_transpose utr ON utr.musica_slug = m.slug AND utr.user_id = ?
    ORDER BY m.created_at DESC
  `,
  )
    .bind(userId, userId, userId)
    .all();

  return c.json(
    results.map((row) => ({
      slug: row.slug,
      titulo: row.titulo,
      artista: row.artista,
      tom: row.user_tom || row.tom,
      tom_original: row.tom_original,
      tags: safeJsonParse(row.tags, []),
      link_youtube: row.link_youtube,
      link_cifraclub: row.link_cifraclub,
      adicionado_por: row.adicionado_por,
      created_at: row.created_at,
      favorito: Boolean(row.favorito),
    })),
  );
});

app.post('/musicas', async (c) => {
  const userId = c.get('userId');
  const { titulo, artista, tom, tom_original, tags, cifra, link_cifraclub, link_youtube } = await readJson(c);
  if (!titulo || !artista || !cifra) return jsonError(c, 400, 'Titulo, artista e cifra sao obrigatorios');

  const slug = slugify(titulo, artista);
  const existing = await c.env.DB.prepare('SELECT slug FROM musicas WHERE slug = ?').bind(slug).first();
  if (existing) return jsonError(c, 409, 'Musica ja existe');

  const chords = extractChordsFromCifra(cifra);
  const chordSvgs = generateChordSVGs(chords);

  await c.env.DB.prepare(
    `
    INSERT INTO musicas (slug, titulo, artista, tom, tom_original, tags, cifra, chord_svgs, link_cifraclub, link_youtube, adicionado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  )
    .bind(
      slug,
      titulo,
      artista,
      tom || null,
      tom_original || null,
      JSON.stringify(tags || []),
      cifra,
      JSON.stringify(chordSvgs),
      link_cifraclub || '',
      link_youtube || '',
      userId,
    )
    .run();

  return c.json({ ok: true, slug });
});

app.put('/musicas/:slug', async (c) => {
  const userId = c.get('userId');
  const slug = c.req.param('slug');
  const existing = await c.env.DB.prepare('SELECT * FROM musicas WHERE slug = ?').bind(slug).first();
  if (!existing) return jsonError(c, 404, 'Musica nao encontrada');

  const body = await readJson(c);
  const titulo = body.titulo ?? existing.titulo;
  const artista = body.artista ?? existing.artista;
  const cifra = body.cifra ?? existing.cifra;
  if (!titulo || !artista || !cifra) return jsonError(c, 400, 'Titulo, artista e cifra sao obrigatorios');

  const chords = extractChordsFromCifra(cifra);
  const chordSvgs = generateChordSVGs(chords);

  await c.env.DB.prepare(
    `
    UPDATE musicas
    SET titulo = ?,
        artista = ?,
        tom = ?,
        tom_original = ?,
        tags = ?,
        cifra = ?,
        chord_svgs = ?,
        link_cifraclub = ?,
        link_youtube = ?
    WHERE slug = ?
  `,
  )
    .bind(
      titulo,
      artista,
      body.tom || null,
      body.tom_original || null,
      JSON.stringify(Array.isArray(body.tags) ? body.tags : safeJsonParse(existing.tags, [])),
      cifra,
      JSON.stringify(chordSvgs),
      body.link_cifraclub || '',
      body.link_youtube || '',
      slug,
    )
    .run();

  const updated = await getMusicaBySlug(c, userId, slug);
  return c.json(updated);
});

app.delete('/musicas/:slug', async (c) => {
  const slug = c.req.param('slug');
  const existing = await c.env.DB.prepare('SELECT slug FROM musicas WHERE slug = ?').bind(slug).first();
  if (!existing) return jsonError(c, 404, 'Musica nao encontrada');

  await c.env.DB.prepare('DELETE FROM favoritos WHERE musica_slug = ?').bind(slug).run();
  await c.env.DB.prepare('DELETE FROM user_tom WHERE musica_slug = ?').bind(slug).run();
  await c.env.DB.prepare('DELETE FROM user_transpose WHERE musica_slug = ?').bind(slug).run();
  await c.env.DB.prepare('DELETE FROM historico WHERE musica_slug = ?').bind(slug).run();
  await c.env.DB.prepare('DELETE FROM musicas WHERE slug = ?').bind(slug).run();

  return c.json({ ok: true });
});

app.get('/musicas/:slug/similares', async (c) => {
  const userId = c.get('userId');
  const slug = c.req.param('slug');
  const musica = await c.env.DB.prepare('SELECT * FROM musicas WHERE slug = ?').bind(slug).first();
  if (!musica) return c.json([]);

  const tags = safeJsonParse(musica.tags, []);
  const { results } = await c.env.DB.prepare(
    `
    SELECT m.*, CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END as favorito
    FROM musicas m
    LEFT JOIN favoritos f ON f.musica_slug = m.slug AND f.user_id = ?
    WHERE m.slug != ?
  `,
  )
    .bind(userId, slug)
    .all();

  const scored = results
    .map((row) => {
      const rowTags = safeJsonParse(row.tags, []);
      const commonTags = rowTags.filter((tag) => tags.includes(tag)).length;
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
      tags: safeJsonParse(row.tags, []),
      favorito: Boolean(row.favorito),
    }));

  return c.json(scored);
});

app.get('/musicas/:slug', async (c) => {
  const userId = c.get('userId');
  const slug = c.req.param('slug');
  const row = await c.env.DB.prepare(
    `
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
  `,
  )
    .bind(userId, userId, userId, slug)
    .first();

  if (!row) return jsonError(c, 404, 'Musica nao encontrada');

  await c.env.DB.prepare('INSERT INTO historico (user_id, musica_slug) VALUES (?, ?)').bind(userId, slug).run();

  return c.json(parseMusica(row));
});

app.get('/favoritos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT musica_slug FROM favoritos WHERE user_id = ? ORDER BY created_at DESC')
    .bind(c.get('userId'))
    .all();
  return c.json(results.map((row) => row.musica_slug));
});

app.post('/favoritos/:slug', async (c) => {
  await c.env.DB.prepare('INSERT OR IGNORE INTO favoritos (user_id, musica_slug) VALUES (?, ?)').bind(c.get('userId'), c.req.param('slug')).run();
  return c.json({ ok: true, favorito: true });
});

app.delete('/favoritos/:slug', async (c) => {
  await c.env.DB.prepare('DELETE FROM favoritos WHERE user_id = ? AND musica_slug = ?').bind(c.get('userId'), c.req.param('slug')).run();
  return c.json({ ok: true, favorito: false });
});

app.get('/user-tom/:slug', async (c) => {
  const row = await c.env.DB.prepare('SELECT tom FROM user_tom WHERE user_id = ? AND musica_slug = ?').bind(c.get('userId'), c.req.param('slug')).first();
  return c.json({ tom: row?.tom || null });
});

app.post('/user-tom/:slug', async (c) => {
  const { tom } = await readJson(c);
  if (!tom) return jsonError(c, 400, 'Tom e obrigatorio');

  await c.env.DB.prepare(
    `
    INSERT INTO user_tom (user_id, musica_slug, tom)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, musica_slug) DO UPDATE SET tom = excluded.tom
  `,
  )
    .bind(c.get('userId'), c.req.param('slug'), tom)
    .run();

  return c.json({ ok: true, tom });
});

app.get('/transpose/:slug', async (c) => {
  const row = await c.env.DB.prepare('SELECT offset FROM user_transpose WHERE user_id = ? AND musica_slug = ?').bind(c.get('userId'), c.req.param('slug')).first();
  return c.json({ offset: row?.offset ?? 0 });
});

app.post('/transpose/:slug', async (c) => {
  const body = await readJson(c);
  const offset = Number.parseInt(body.offset ?? 0, 10);

  await c.env.DB.prepare(
    `
    INSERT INTO user_transpose (user_id, musica_slug, offset)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, musica_slug) DO UPDATE SET offset = excluded.offset
  `,
  )
    .bind(c.get('userId'), c.req.param('slug'), Number.isFinite(offset) ? offset : 0)
    .run();

  return c.json({ ok: true, offset: Number.isFinite(offset) ? offset : 0 });
});

app.get('/historico', async (c) => {
  const { results } = await c.env.DB.prepare(
    `
    SELECT h.musica_slug, MAX(h.acessado_em) as acessado_em,
      m.titulo, m.artista, m.tags
    FROM historico h
    JOIN musicas m ON m.slug = h.musica_slug
    WHERE h.user_id = ?
    GROUP BY h.musica_slug
    ORDER BY acessado_em DESC
    LIMIT 10
  `,
  )
    .bind(c.get('userId'))
    .all();

  return c.json(
    results.map((row) => ({
      slug: row.musica_slug,
      titulo: row.titulo,
      artista: row.artista,
      tags: safeJsonParse(row.tags, []),
      acessado_em: row.acessado_em,
    })),
  );
});

app.get('/cifraclub/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return jsonError(c, 400, 'Parametro q obrigatorio');

  try {
    return c.json(await searchCifraClub(q));
  } catch (err) {
    return jsonError(c, 500, `Erro ao buscar no CifraClub: ${err.message}`);
  }
});

app.get('/cifraclub/fetch', async (c) => {
  const url = c.req.query('url');
  if (!url) return jsonError(c, 400, 'Parametro url obrigatorio');

  try {
    const cifraData = await fetchCifra(url);
    const tags = await suggestTags(c.env, cifraData.titulo, cifraData.artista, cifraData.cifra);
    return c.json({ ...cifraData, tags_sugeridas: tags });
  } catch (err) {
    return jsonError(c, 500, `Erro ao buscar cifra: ${err.message}`);
  }
});

export const onRequest = handle(app);
