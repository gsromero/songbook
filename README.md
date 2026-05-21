# Songbook

Catálogo pessoal de repertório de violão com cifras, tracker de progresso e plano de estudos. Site estático gerado com Astro, hospedado no GitHub Pages.

**[→ Abrir o site](https://gsromero.github.io/songbook/)**

## Funcionalidades

- Lista de 49 músicas com filtros por nível, status, artista e busca textual
- Página individual por música com cifra em formato Cifra Club
- Tooltip de diagrama SVG ao passar o mouse sobre qualquer acorde
- Toggle de 1/2/3 colunas para a cifra (persiste no localStorage)
- Tracker de progresso com barras por nível e status
- Plano de estudos em 3 fases com checklist persistente

## Rodando localmente

```bash
pnpm install
pnpm dev        # http://localhost:4321/songbook/
pnpm build      # gera dist/
pnpm preview    # previa do build
```

## Como adicionar uma música

1. Crie `src/content/musicas/<slug>.md`:

```markdown
---
titulo: "Nome da Música"
artista: "Nome do Artista"
slug: "nome-da-musica"
nivel: "N2"
status: "nao_classificado"
tom: "G"
tags: ["rock", "mpb"]
links:
  cifraclub: ""
  youtube: ""
observacoes: ""
---

    G          Em
Primeira linha de cifra
    C          D
Segunda linha de cifra
```

2. Execute `pnpm build` — o sistema extrai os acordes da cifra e gera os SVGs de diagrama automaticamente.

## Convenções de slug e tags

**Slug:** título + artista normalizados, sem acentos, hífens no lugar de espaços. Versões da mesma música levam sufixo: `sozinho-simples`, `sozinho-completa`.

**Tags canônicas:** `mpb`, `rock`, `samba`, `pagode`, `jazz`, `bossa`, `forro`, `sertanejo`, `pop`, `latin`, `indie`, `instrumental`, `fingerstyle`, `dedilhado-simples`

## Sistema de níveis e status

| Nível | Descrição |
|-------|-----------|
| N1 | Acordes abertos + batida simples |
| N2 | Pestanas básicas + acordes com 7 + variações de batida |
| N3 | Arpejos/dedilhado + acordes com extensões + pestanas múltiplas |
| N4 | Dedilhado independente + hammer-on/pull-off |
| N5 | Fingerstyle completo |

| Status | Significado |
|--------|-------------|
| 🟢 `toca_bem` | Toco bem |
| 🟡 `toca_parcial` | Toco parcialmente |
| 🔴 `wishlist` | Quero aprender |
| ⚪ `nao_classificado` | Ainda não avaliado |

## Stack

- [Astro 6](https://astro.build) — framework de site estático
- [Tailwind CSS v4](https://tailwindcss.com) — estilização via plugin Vite
- [chordsheetjs](https://github.com/martijnversluis/ChordSheetJS) — parser de cifras no formato Cifra Club
- [@tombatossals/chords-db](https://github.com/tombatossals/chords-db) — banco de digitações de acorde
- SVG gerado em build-time (sem dependência de DOM em runtime)
- Hospedagem: GitHub Pages via GitHub Actions

## Deploy

Todo push na branch `main` dispara o workflow `.github/workflows/deploy.yml` que builda e publica automaticamente.
