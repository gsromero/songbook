# Plano — Editar e Apagar música (para o Codex executar)

> A migração para a Cloudflare não trouxe as rotas de **editar** e **apagar** música que existiam no
> homelab. Hoje só dá para adicionar. Este plano recria essas duas operações (backend + UI na página da música).
> Bônus: a rota `DELETE /api/musicas/:slug` também conserta a limpeza do smoke test.
>
> **Divisão:** Codex executa numa branch + valida (build + smoke) e **entrega**. Claude revisa o diff e **publica**.
> **🛑 Codex NÃO publica em produção, não mexe em DNS/secrets/PM2/outros projetos.**

---

## 0) Contexto (verificado no código)

- Backend: **Hono** em `functions/api/[[slug]].js`. Hoje existem para música: `GET /musicas`, `POST /musicas`, `GET /musicas/:slug`, `GET /musicas/:slug/similares`. **Faltam `PUT` e `DELETE`.**
- O `POST /api/musicas` (~linha 464) já mostra o padrão: lê `{ titulo, artista, tom, tom_original, tags, cifra, link_cifraclub, link_youtube }`, roda `extractChordsFromCifra(cifra)` + `generateChordSVGs(chords)` e grava `chord_svgs`. **Reaproveitar isso no PUT.**
- Tabelas que referenciam o slug: `musicas`, `favoritos`, `user_tom`, `user_transpose`, `historico` (a remoção precisa limpar todas).
- Frontend da página da música: `src/pages/musica/index.astro` (hoje só tem o toggle de favorito; sem editar/apagar).
- Auth por cookie JWT (middleware `_middleware.js`); D1 é assíncrono.

---

## 1) Permissões
Mesmas do projeto: Codex pode escrever em `d:\Git\songbook` e rodar `git`, `pnpm`, `node`, `npx wrangler`, `curl`. **🛑 Não** fazer deploy de produção (`--branch main`), nem tocar em DNS, custom domain, secrets, PM2 ou outros projetos.

## 2) Branch
```bash
cd d:\Git\songbook
git checkout main && git pull
git checkout -b feat/editar-apagar-musica
```

---

## 3) Backend — `functions/api/[[slug]].js`

Adicionar duas rotas (perto das outras de `/musicas`, respeitando a ordem: rotas com sufixo fixo antes das genéricas). Ambas exigem usuário autenticado (mesmo critério das outras rotas protegidas).

### `PUT /musicas/:slug` (editar)
- Ler o corpo `{ titulo, artista, tom, tom_original, tags, cifra, link_cifraclub, link_youtube }`.
- **Não alterar o `slug`** (mantém favoritos/links válidos).
- Se a `cifra` veio no corpo, **regenerar** `cifra_acordes`/`chord_svgs` com as mesmas funções do POST (`extractChordsFromCifra` + `generateChordSVGs`).
- `UPDATE musicas SET titulo=?, artista=?, tom=?, tom_original=?, tags=?, cifra=?, chord_svgs=?, link_cifraclub=?, link_youtube=? WHERE slug=?`.
- Retornar a música atualizada (mesmo formato do `GET /musicas/:slug`). 404 se o slug não existir.

### `DELETE /musicas/:slug` (apagar)
- Apagar de **todas** as tabelas que referenciam o slug:
  ```sql
  DELETE FROM favoritos WHERE slug=?;
  DELETE FROM user_tom WHERE slug=?;
  DELETE FROM user_transpose WHERE slug=?;
  DELETE FROM historico WHERE slug=?;
  DELETE FROM musicas WHERE slug=?;
  ```
- Retornar `{ ok: true }`. 404 se não existir.
- (Se houver tabela/trigger FTS de músicas, garantir que sincroniza — conferir o `migrations/0001_init.sql`.)

---

## 4) Frontend — `src/pages/musica/index.astro`

Na página da música, adicionar (de forma discreta, perto do topo/cabeçalho da música — manter o resto intacto):

### Botão "Editar"
- Abre um modal/painel com um formulário pré-preenchido com os dados atuais: Título, Artista, Tom, Tom original, Tags (separadas por vírgula), Cifra (textarea grande), Link CifraClub, Link YouTube.
- Salvar → `PUT /api/musicas/:slug` com o corpo. Em sucesso, recarregar a página (ou atualizar os dados exibidos).
- Reaproveitar estilos/markup do modal de adicionar do `index.astro` quando fizer sentido (mesma cara).

### Botão "Apagar"
- Pede confirmação (ex.: `confirm('Apagar "<título>"? Esta ação não pode ser desfeita.')`).
- Confirmar → `DELETE /api/musicas/:slug`. Em sucesso, **redirecionar para `/`** (repertório).

### Regras
- Manter 100% do que já existe na página (transpose, acordes, modo prática, favoritar, colunas, i18n, tema).
- Preservar a estética papel/creme.

---

## 5) Validar (build + smoke) — antes de entregar

```bash
pnpm build   # tem que passar sem erro

# deploy de PREVIEW (não produção)
npx wrangler pages deploy --project-name songbook --branch feat/editar-apagar-musica --commit-dirty=true
```

> ⚠️ O **preview não tem os secrets** (login dá 500 nele). Então o smoke test de ponta a ponta deve ser rodado pelo **Claude na produção** depois de publicar. O Codex valida o que dá no preview/local (build limpo, páginas carregam) e entrega.

Commit + push na branch:
```bash
git add -A
git commit -m "feat: editar e apagar musica (rotas PUT/DELETE + UI na pagina da musica)"
git push -u origin feat/editar-apagar-musica
```

## 6) 🛑 Handoff para o Claude
Reportar: resumo do que mudou, confirmação de que `pnpm build` passou, e a URL de preview. **Não publicar em produção.**

O Claude vai: ler o diff, publicar em produção, e rodar `SMOKE_PASS=... node scripts/smoke.mjs https://songbook.gsromerolab.com` — que agora também testa o **DELETE** (limpeza automática via API).

---

## Checklist (Codex confere antes do handoff)
- [ ] `pnpm build` passou sem erro.
- [ ] `PUT /musicas/:slug` edita e **regenera os acordes** quando a cifra muda; não altera o slug.
- [ ] `DELETE /musicas/:slug` remove a música e as linhas relacionadas (favoritos, user_tom, user_transpose, historico).
- [ ] Página da música tem botões **Editar** (form pré-preenchido) e **Apagar** (com confirmação → volta pro `/`).
- [ ] Nada do que já existia na página quebrou (transpose, acordes, favoritar, prática, i18n, tema).
- [ ] Trabalhou em `feat/editar-apagar-musica`; **não** publicou em produção.
