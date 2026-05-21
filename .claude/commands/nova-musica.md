Você vai adicionar uma nova música ao projeto Guitar Master em `d:\Git\songbook`.

## Passos obrigatórios — siga nessa ordem exata

### 1. Ler os resources disponíveis
Leia o arquivo `d:\Git\songbook\.claude\guitar-resources.md` para saber em quais sites buscar.

### 2. Buscar a cifra
Use WebSearch para encontrar a cifra da música nos resources listados.
Prioridade: Cifra Club (cifraclub.com.br) → Ultimate Guitar → Letras.

Extraia do resultado:
- Título exato da música
- Artista
- Tom original da gravação (`tomOriginal`)
- Tom em que a cifra está escrita (pode ser diferente do original se o site já adaptar)
- Acordes utilizados
- A cifra completa no formato chords-over-words (acordes na linha acima da letra, com seções como `[Intro]`, `[Verso]`, etc.)

**NUNCA use capotraste.** Se o site indicar capotraste, encontre ou construa a versão sem capotraste transpondo para o tom equivalente.

### 3. Perguntar o tom ao usuário
Mostre o tom encontrado e pergunte:
> "Encontrei a cifra em [tom X]. Em que tom você quer tocar? (pode deixar em branco para manter o mesmo)"

Se o tom escolhido for diferente do tom da cifra, transponha todos os acordes antes de salvar.

### 4. Inferir os campos restantes
- `nivel`: N1 (acordes abertos simples), N2 (pestanas básicas), N3 (extensões/arpejos), N4 (fingerstyle)
- `status`: `nao_classificado` (padrão)
- `tags`: mpb, rock, samba, jazz, pop, bossa, forro, sertanejo, latin, indie, instrumental, fingerstyle — escolha as mais adequadas ao estilo do artista/música
- `slug`: título + artista em minúsculas, sem acentos, hífens no lugar de espaços e caracteres especiais

### 5. Mostrar preview completo
Antes de criar qualquer arquivo, exiba o conteúdo completo do `.md` que será criado e aguarde confirmação do usuário.

### 6. Criar o arquivo
Crie `d:\Git\songbook\src\content\musicas\[slug].md` com o seguinte formato:

```
---
titulo: "Título da Música"
artista: "Nome do Artista"
slug: "slug-da-musica"
nivel: "N2"
status: "nao_classificado"
tom: "A"
tomOriginal: "D"
tags: ["mpb", "dedilhado-simples"]
links:
  cifraclub: ""
  youtube: ""
observacoes: ""
---

[Intro]
ACORDE   ACORDE

[Verso]
ACORDE          ACORDE
Letra da música aqui
```

### 7. Validar e publicar
Execute em sequência:
```
pnpm build
git add src/content/musicas/[slug].md
git commit -m "feat: adicionar [titulo] - [artista]"
git push
```

Reporte o resultado ao usuário.

---

## Restrições importantes
- **Nunca sugira capotraste** — se a fonte usar capotraste, transponha para o tom equivalente sem ele
- O tom no frontmatter (`tom`) é sempre o tom em que a cifra está escrita (que o usuário vai tocar)
- O `tomOriginal` é o tom da gravação original do artista
- Siga o formato exato de `london-london.md` como referência

---

$ARGUMENTS
