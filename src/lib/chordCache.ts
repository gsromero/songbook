import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { renderChordSVG, type ChordPosition } from './chordRenderer.js';

interface ChordsDB {
  guitar: {
    keys: string[];
    suffixes: string[];
    chords: Record<string, Array<{ key: string; suffix: string; positions: ChordPosition[] }>>;
  };
}

// Maps chord root to chords-db key format
const ROOT_MAP: Record<string, string> = {
  C: 'C', 'C#': 'Csharp', Db: 'Csharp',
  D: 'D', 'D#': 'Eb', Eb: 'Eb',
  E: 'E', Fb: 'E',
  F: 'F', 'F#': 'Fsharp', Gb: 'Fsharp',
  G: 'G', 'G#': 'Ab', Ab: 'Ab',
  A: 'A', 'A#': 'Bb', Bb: 'Bb',
  B: 'B', Cb: 'B',
};

// Maps chord suffix notation to chords-db suffix strings
const SUFFIX_MAP: Record<string, string> = {
  '': 'major', maj: 'major',
  m: 'minor', min: 'minor',
  '7': '7', 'm7': 'm7', maj7: 'maj7', M7: 'maj7',
  '9': '9', 'm9': 'm9', maj9: 'maj9', add9: 'add9',
  '11': '11', '13': '13',
  dim: 'dim', '°': 'dim', 'º': 'dim',
  dim7: 'dim7', '°7': 'dim7',
  aug: 'aug', '+': 'aug',
  sus2: 'sus2', sus4: 'sus4', sus: 'sus4',
  m7b5: 'm7b5', ø: 'm7b5', 'ø7': 'm7b5',
  '6': '6', m6: 'm6',
  '5': '5',
  '7sus4': '7sus4',
};

function parseChordName(raw: string): { dbKey: string; suffix: string } | null {
  const m = raw.trim().match(/^([A-G][b#]?)(.*)$/);
  if (!m) return null;
  const root = m[1] ?? '';
  const suffix = m[2]?.trim() ?? '';
  const dbKey = ROOT_MAP[root];
  if (!dbKey) return null;
  const mappedSuffix = SUFFIX_MAP[suffix] ?? suffix;
  return { dbKey, suffix: mappedSuffix };
}

function extractChordsFromMarkdown(body: string): string[] {
  const chordPattern = /\b([A-G][b#]?(?:maj|min|m|dim|aug|sus)?[0-9]?(?:[b#][0-9])?)\b/g;
  const chords = new Set<string>();
  // Only scan lines that look like chord lines (mostly uppercase + chord chars)
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('<!--')) continue;
    const words = trimmed.split(/\s+/);
    const chordCount = words.filter(w => /^[A-G][b#]?/.test(w)).length;
    if (chordCount > 0 && chordCount >= words.length * 0.5) {
      let match: RegExpExecArray | null;
      while ((match = chordPattern.exec(trimmed)) !== null) {
        const candidate = match[1];
        if (candidate) chords.add(candidate);
      }
    }
  }
  return Array.from(chords);
}

export async function buildChordCache(projectRoot: string): Promise<void> {
  const musicasDir = join(projectRoot, 'src/content/musicas');
  const outPath = join(projectRoot, 'src/lib/chord-svgs.generated.json');

  if (!existsSync(musicasDir)) return;

  // Collect all unique chord names from all .md files
  const allChords = new Set<string>();
  for (const file of readdirSync(musicasDir).filter(f => f.endsWith('.md'))) {
    const content = readFileSync(join(musicasDir, file), 'utf-8');
    // Extract body (after second ---)
    const parts = content.split('---');
    const body = parts.slice(2).join('---');
    for (const chord of extractChordsFromMarkdown(body)) {
      allChords.add(chord);
    }
  }

  if (allChords.size === 0) {
    writeFileSync(outPath, '{}', 'utf-8');
    return;
  }

  // Load chords-db
  const dbPath = resolve(projectRoot, 'node_modules/@tombatossals/chords-db/lib/guitar.json');
  if (!existsSync(dbPath)) {
    console.warn('[chordCache] chords-db not found, skipping SVG generation');
    writeFileSync(outPath, '{}', 'utf-8');
    return;
  }

  const db = JSON.parse(readFileSync(dbPath, 'utf-8')) as ChordsDB['guitar'];
  const result: Record<string, string> = {};

  for (const chord of allChords) {
    const parsed = parseChordName(chord);
    if (!parsed) {
      console.warn(`[chordCache] Cannot parse: ${chord}`);
      continue;
    }

    const group = db.chords[parsed.dbKey];
    if (!group) {
      console.warn(`[chordCache] Key not found: ${parsed.dbKey} (from "${chord}")`);
      continue;
    }

    const entry = group.find(g => g.suffix === parsed.suffix);
    if (!entry || !entry.positions.length) {
      console.warn(`[chordCache] Suffix "${parsed.suffix}" not found for ${chord}`);
      continue;
    }

    const pos = entry.positions[0];
    if (pos) {
      result[chord] = renderChordSVG(chord, pos);
    }
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[chordCache] Generated SVGs for ${Object.keys(result).length}/${allChords.size} chords`);
}
