import type { AstroIntegration } from 'astro';
import { buildChordCache } from '../lib/chordCache.js';

export function chordPrerender(): AstroIntegration {
  return {
    name: 'chord-prerender',
    hooks: {
      'astro:build:start': async ({ logger }) => {
        logger.info('Generating chord SVGs...');
        try {
          await buildChordCache(process.cwd());
          logger.info('Chord SVGs ready.');
        } catch (err) {
          logger.warn(`Chord SVG generation failed: ${String(err)}`);
        }
      },
    },
  };
}
