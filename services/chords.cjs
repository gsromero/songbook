const path = require('path');
const fs = require('fs');

// ── SVG renderer (ported from chordRenderer.ts) ──────────────────────────────

const STRINGS = 6;
const FRETS = 4;
const SS = 14; // string spacing
const FS = 18; // fret spacing
const GL = 18; // grid left
const GT = 40; // grid top
const DR = 5;  // dot radius
const W = GL + SS * (STRINGS - 1) + 22;
const H = GT + FS * FRETS + 16;

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderChordSVG(name, pos) {
  const parts = [];

  parts.push(`<text x="${W / 2}" y="13" text-anchor="middle" font-size="11" font-weight="bold" font-family="sans-serif" fill="currentColor">${esc(name)}</text>`);

  const nutW = pos.baseFret === 1 ? 4 : 1.5;
  parts.push(`<line x1="${GL}" y1="${GT}" x2="${GL + SS * (STRINGS - 1)}" y2="${GT}" stroke="currentColor" stroke-width="${nutW}" stroke-linecap="round"/>`);

  if (pos.baseFret > 1) {
    parts.push(`<text x="${GL + SS * (STRINGS - 1) + 5}" y="${GT + FS * 0.65}" font-size="9" font-family="sans-serif" fill="currentColor" fill-opacity="0.7">${pos.baseFret}fr</text>`);
  }

  for (let f = 1; f <= FRETS; f++) {
    const y = GT + f * FS;
    parts.push(`<line x1="${GL}" y1="${y}" x2="${GL + SS * (STRINGS - 1)}" y2="${y}" stroke="currentColor" stroke-opacity="0.35" stroke-width="1"/>`);
  }

  for (let s = 0; s < STRINGS; s++) {
    const x = GL + s * SS;
    parts.push(`<line x1="${x}" y1="${GT}" x2="${x}" y2="${GT + FS * FRETS}" stroke="currentColor" stroke-opacity="0.55" stroke-width="1"/>`);
  }

  for (let s = 0; s < STRINGS; s++) {
    const x = GL + s * SS;
    const fret = pos.frets[s];
    if (fret === -1) {
      parts.push(`<text x="${x}" y="${GT - 6}" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.55">×</text>`);
    } else if (fret === 0) {
      parts.push(`<circle cx="${x}" cy="${GT - 9}" r="4" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5"/>`);
    }
  }

  for (const barre of pos.barres) {
    const row = barre - 1;
    const y = GT + row * FS + FS / 2;
    const barreStrings = pos.frets.map((f, i) => ({ f, i })).filter(({ f }) => f === barre);
    if (barreStrings.length >= 2) {
      const x1 = GL + (barreStrings[0]?.i ?? 0) * SS;
      const x2 = GL + (barreStrings[barreStrings.length - 1]?.i ?? STRINGS - 1) * SS;
      parts.push(`<rect x="${x1 - DR}" y="${y - DR}" width="${x2 - x1 + DR * 2}" height="${DR * 2}" rx="${DR}" fill="currentColor"/>`);
    }
  }

  for (let s = 0; s < STRINGS; s++) {
    const fret = pos.frets[s];
    if (fret > 0 && !pos.barres.includes(fret)) {
      const row = fret - 1;
      const x = GL + s * SS;
      const y = GT + row * FS + FS / 2;
      parts.push(`<circle cx="${x}" cy="${y}" r="${DR}" fill="currentColor"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Diagrama de ${esc(name)}">${parts.join('')}</svg>`;
}

// ── Chord name parser ─────────────────────────────────────────────────────────

const ROOT_MAP = {
  C: 'C', 'C#': 'Csharp', Db: 'Csharp',
  D: 'D', 'D#': 'Eb', Eb: 'Eb',
  E: 'E', Fb: 'E',
  F: 'F', 'F#': 'Fsharp', Gb: 'Fsharp',
  G: 'G', 'G#': 'Ab', Ab: 'Ab',
  A: 'A', 'A#': 'Bb', Bb: 'Bb',
  B: 'B', Cb: 'B',
};

const SUFFIX_MAP = {
  '': 'major', maj: 'major',
  m: 'minor', min: 'minor',
  // Maj7 aliases (CifraClub usa "7M", "M7", "maj7", "Maj7")
  '7': '7', m7: 'm7', maj7: 'maj7', M7: 'maj7', '7M': 'maj7', Maj7: 'maj7',
  '9': '9', m9: 'm9', maj9: 'maj9', add9: 'add9',
  '11': '11', '13': '13',
  dim: 'dim', '°': 'dim', 'º': 'dim',
  dim7: 'dim7', '°7': 'dim7',
  aug: 'aug', '+': 'aug',
  sus2: 'sus2', sus4: 'sus4', sus: 'sus4',
  // Acordes com 4ª (CifraClub usa "4" para sus4 às vezes)
  '4': 'sus4',
  m7b5: 'm7b5', ø: 'm7b5', 'ø7': 'm7b5',
  '6': '6', m6: 'm6',
  '5': '5',
  '7sus4': '7sus4',
};

function parseChordName(raw) {
  const m = raw.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!m) return null;
  const root = m[1] ?? '';
  const suffix = (m[2] ?? '').trim();
  const dbKey = ROOT_MAP[root];
  if (!dbKey) return null;
  const mappedSuffix = SUFFIX_MAP[suffix] ?? suffix;
  return { dbKey, suffix: mappedSuffix };
}

// ── Extract chords from cifra text ───────────────────────────────────────────

function extractChordsFromCifra(cifraText) {
  const chordPattern = /\b([A-G][b#]?(?:maj|min|m|dim|aug|sus)?[0-9]?(?:[b#][0-9])?)\b/g;
  const chords = new Set();

  for (const line of cifraText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('<!--')) continue;
    const words = trimmed.split(/\s+/);
    const chordCount = words.filter(w => /^[A-G][b#]?/.test(w)).length;
    if (chordCount > 0 && chordCount >= words.length * 0.5) {
      let match;
      const re = new RegExp(chordPattern.source, 'g');
      while ((match = re.exec(trimmed)) !== null) {
        if (match[1]) chords.add(match[1]);
      }
    }
  }

  return Array.from(chords);
}

// ── Generate SVG map for a list of chord names ────────────────────────────────

function generateChordSVGs(chordNames) {
  const dbPath = path.resolve(__dirname, '../node_modules/@tombatossals/chords-db/lib/guitar.json');

  if (!fs.existsSync(dbPath)) {
    console.warn('[chords] chords-db não encontrado');
    return {};
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  const result = {};

  for (const chord of chordNames) {
    const parsed = parseChordName(chord);
    if (!parsed) continue;

    const group = db.chords[parsed.dbKey];
    if (!group) continue;

    const entry = group.find(g => g.suffix === parsed.suffix);
    if (!entry || !entry.positions.length) continue;

    const pos = entry.positions[0];
    if (pos) result[chord] = renderChordSVG(chord, pos);
  }

  return result;
}

module.exports = { extractChordsFromCifra, generateChordSVGs, renderChordSVG };
