# Plano — Repaginar Repertório + Importação manual de cifra (para o Codex executar)

> Dois objetivos no songbook (já migrado para Cloudflare Pages + D1):
> 1. **Repaginar o visual** da tela de Repertório (mantendo 100% das funcionalidades).
> 2. **Criar um fluxo alternativo de importação** que funcione mesmo com o bloqueio 403 do CifraClub
>    (o IP de datacenter da Cloudflare é barrado ao baixar a cifra).
>
> **Divisão de trabalho (IMPORTANTE):** o **Codex executa** tudo numa branch + **deploy de PREVIEW**.
> **NÃO publicar em produção.** Quem revisa o diff e publica em produção é o Claude.
>
> **Dono:** não-programador. Não pedir confirmação a cada passo; só parar nos pontos marcados com 🛑.

---

## 0) Contexto técnico (verificado no código)

- Frontend: **Astro estático** (`output: 'static'`), tela principal em `src/pages/index.astro` (518 linhas; markup + `<script>` + `<style>` no mesmo arquivo). A lista de músicas é montada **no cliente** via JS (`renderCard`, `#card-grid`).
- Backend: **Hono** em `functions/api/[[slug]].js`. Auth por **cookie JWT** (login em `POST /api/auth/login`).
- **`POST /api/musicas` (linha ~464) JÁ aceita a cifra pronta** no corpo e roda `extractChordsFromCifra` + `generateChordSVGs` no servidor, salvando `chord_svgs`. **Ou seja, salvar não depende do scraping.**
- O 403 acontece só em `GET /api/cifraclub/fetch` (linha ~666 → `fetchCifra`), que serve para **auto-preencher** o formulário. A **busca** (`GET /api/cifraclub/search`, via Startpage) **funciona**.
- Deploy: `wrangler pages deploy --project-name songbook`. Branch de produção = `main`. Qualquer outra branch = **preview** (URL própria, não afeta produção).
- Pré-requisitos já OK: `pnpm`, `wrangler` autenticado, D1 `songbook-db` com dados, secrets `JWT_SECRET` e `GEMINI_API_KEY` setados.

---

## 1) Permissões

**Codex pode (precisa de permissão para):**
- Escrever arquivos em `d:\Git\songbook`.
- Executar: `git`, `pnpm`, `node`, `npx wrangler`, `curl`.
- Acesso à internet (instalar deps, `wrangler` falar com a Cloudflare, deploy de preview, testar a URL de preview).

**🛑 Codex NÃO deve:**
- Fazer deploy/promote para **produção** (a branch `main` / `songbook.gsromerolab.com`). Só **preview**.
- Mexer em DNS, custom domain, secrets ou no PM2 do homelab.
- Tocar em outros projetos da pasta `d:\Git`.

---

## 2) Branch
```bash
cd d:\Git\songbook
git checkout main && git pull
git checkout -b feat/repertorio-ui-e-import-manual
```

---

## PARTE 1 — Repaginação visual do Repertório

**Arquivo principal:** `src/pages/index.astro` (markup do `renderCard` ~linha 195–211, `recentes-grid` ~linha 148–154, e o bloco `<style>` a partir de ~linha 456). Ajustes pontuais em `src/layouts/Base.astro` e `src/components/Filtros.astro` se necessário.

### Regras de ouro
- **Manter TODAS as funcionalidades, IDs e handlers JS.** Não renomear `#card-grid`, `#recentes-grid`, `#filtro-*`, `.card-heart`, `data-slug`, etc. — o JS depende deles. É uma repaginação de **markup/CSS**, não de lógica.
- **Preservar a identidade visual** (estética "papel/caderno" creme, tema claro/escuro, idiomas PT/EN). É deixar mais limpo e organizado, não trocar a cara.

### O que melhorar
1. **Cartões de verdade** (`.music-card`): borda sutil, padding generoso, cantos arredondados, leve sombra/realce no `:hover`. Grid responsivo confortável, ex.:
   ```css
   .card-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
   ```
   (hoje a lista fica esparsa e "solta" — dar contorno e ritmo visual).
2. **Hierarquia no card:** título (`.card-title`) em destaque com a fonte de display; artista (`.card-artist`) em cor mais suave; **tom** (`.card-tom`) como uma **pílula** pequena.
3. **Tags como chips espaçados** — corrigir o bug do `#mpb#dedilhado-simples` grudado. Hoje em `renderCard` (~linha 197):
   ```js
   const tags = (m.tags || []).slice(0,3).map(t => `<a class="card-tag" href="/?tag=${encodeURIComponent(t)}">#${t}</a>`).join('');
   ```
   Envolver os chips num container flex com `gap` e dar padding/estilo de chip a `.card-tag` (ex.: `display:inline-flex; gap:.4rem; flex-wrap:wrap` no container; cada `.card-tag` com `padding:.1rem .5rem; border:1px solid var(--paper-line); border-radius:999px`). Garantir separação visual clara.
4. **Coração (favoritar) × selo "novo":** no topo do card, deixar os dois claramente distintos — o ♥ é botão de favorito (mantém `.card-heart` e o handler), o "novo" é um selo discreto. Hoje ficam ambíguos lado a lado.
5. **"Tocadas recentemente"** (`#recentes-grid`): transformar em **pílulas clicáveis** bem espaçadas (título + artista), em vez de texto corrido. Já é `flex-wrap` — melhorar o estilo de cada `.recente-card`.
6. **Barra de filtros** (`.controls.filtros`): alinhar melhor os grupos (busca, tags, artista, ordenar, favoritos/limpar), com espaçamento consistente e bom comportamento no mobile (quebrar em linhas sem amontoar).
7. **Respiro geral:** largura máxima de conteúdo confortável, espaçamento vertical entre seções, tipografia legível.

### Não fazer
- Não trocar framework/bibliotecas, não adicionar dependências pesadas de UI.
- Não alterar a página da música (`src/pages/musica/`) nesta tarefa — foco no Repertório (index).

---

## PARTE 2 — Importação manual da cifra (contornar o 403)

**Ideia:** como `POST /api/musicas` já gera acordes/SVGs a partir da cifra enviada, o usuário **cola a cifra** em vez de depender do download (que dá 403).

### Frontend (`src/pages/index.astro`)
Adicionar um modo **"Colar cifra"** no fluxo de adicionar música (reaproveitar o modal de confirmação existente `#modal-confirmar`, ou criar um modal irmão):
1. (Opcional) Campo **URL do CifraClub**: ao colar, extrair **artista** e **título** do slug `…/artista/musica/` para pré-preencher os campos e guardar como `link_cifraclub`. (Função simples de parse do path da URL — sem fazer fetch.)
2. Campos: **Título**, **Artista**, **Tom** (mantém o campo de tags; a sugestão via Gemini continua funcionando se já existir).
3. **Textarea "Cole a cifra aqui"**: o usuário copia a cifra (acordes sobre a letra) da página do CifraClub e cola.
4. **Botão Salvar** → `POST /api/musicas` com `{ titulo, artista, tom, cifra, tags, link_cifraclub }` (o backend já cuida de extrair acordes e gerar os SVGs). Após salvar, fechar o modal e recarregar a lista.

### Pontos de UX
- Deixar claro na tela o caminho: **Buscar no CifraClub** (funciona) → abrir a música no site → **copiar a cifra** → **colar aqui**. Um texto curto de ajuda já basta.
- Manter o fluxo antigo de busca (`/api/cifraclub/search`) como atalho para achar a música. Se o auto-preenchimento por `fetch` for tentado e falhar (403), **cair graciosamente** no modo "colar" em vez de só mostrar erro.

### Backend
- **Nenhuma mudança obrigatória** — `POST /api/musicas` já resolve. Só se for conveniente, adicionar um helper para extrair título/artista do slug da URL (pode ser no cliente mesmo).
- **Não** remover o `/api/cifraclub/fetch` (deixar como está; pode voltar a funcionar no futuro com outra abordagem).

---

## 3) Build + deploy de PREVIEW (não produção)
```bash
pnpm build
# Deploy de PREVIEW: usar a branch (qualquer coisa != main vira preview com URL própria)
npx wrangler pages deploy --project-name songbook --branch feat/repertorio-ui-e-import-manual --commit-dirty=true
```
Anotar a **URL de preview** (`https://<hash>.songbook-48t.pages.dev` ou similar) que o comando imprime.

## 4) Commit + push (na branch, NÃO na main)
```bash
git add -A
git commit -m "feat: repagina Repertório + importação manual de cifra"
git push -u origin feat/repertorio-ui-e-import-manual
```

## 5) 🛑 Handoff para o Claude (NÃO publicar)
Ao terminar, reportar:
- A **URL de preview**.
- Resumo do que mudou (arquivos + principais ajustes).
- Qualquer coisa que não deu pra fazer.

**O Claude vai:** revisar o diff, testar no preview (login, listar, filtrar, favoritar, **importar colando uma cifra real**), e só então **publicar em produção** (`--branch main`) e validar em `songbook.gsromerolab.com`.

---

## Checklist de verificação (o Codex confere no preview antes do handoff)
- [ ] `pnpm build` passou sem erro.
- [ ] Login funciona no preview (cookie JWT).
- [ ] Lista mostra as 6 músicas, agora com cards organizados.
- [ ] Tags aparecem como chips **separados** (sem `#mpb#dedilhado-simples` grudado).
- [ ] Busca, filtro de tags, filtro de artista, ordenação, favoritos e "Limpar" continuam funcionando.
- [ ] "Tocadas recentemente" e filtros com visual limpo; responsivo no mobile.
- [ ] Tema claro/escuro e PT/EN continuam funcionando.
- [ ] Novo fluxo "Colar cifra": dá para colar uma cifra + preencher campos e salvar; a música aparece com os diagramas de acorde gerados.
- [ ] Nada foi publicado em produção (deploy só com `--branch feat/...`).

## Lembretes
- D1 é assíncrono (`await`). Cookie de auth é HttpOnly de mesma origem — os `fetch('/api/...')` do cliente já mandam o cookie.
- Não commitar `.env`, `db/*.db` (já no `.gitignore`).
- Foco no Repertório (`index.astro`); não refatorar o resto.
