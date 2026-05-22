import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Mantém apenas o plano de estudos (músicas migraram para SQLite)
const plano = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plano' }),
  schema: z.object({
    titulo: z.string(),
    fase: z.number(),
    duracao: z.string().optional(),
  }),
});

export const collections = { plano };
