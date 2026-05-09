import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const musicas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/musicas' }),
  schema: z.object({
    titulo: z.string(),
    artista: z.string(),
    slug: z.string(),
    nivel: z.enum(['N1', 'N2', 'N3', 'N4', 'N5']),
    status: z
      .enum(['toca_bem', 'toca_parcial', 'wishlist', 'nao_classificado'])
      .default('nao_classificado'),
    tom: z.string().optional(),
    tags: z.array(z.string()).default([]),
    links: z
      .object({
        cifraclub: z.string().optional(),
        youtube: z.string().optional(),
      })
      .optional(),
    observacoes: z.string().optional(),
  }),
});

const plano = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/plano' }),
  schema: z.object({
    titulo: z.string(),
    fase: z.number(),
    duracao: z.string().optional(),
  }),
});

export const collections = { musicas, plano };
