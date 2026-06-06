# Songbook → Cloudflare Pages — Instruções de Migração (para o Codex executar)

> Migrar o **songbook** do homelab (Astro estático + Express + `node:sqlite` + PM2, porta 4000)
> para **Cloudflare Pages + D1**, seguindo o MESMO molde já usado em `storetag` e `grimoire`.
> Objetivo: o site rodar na nuvem (`songbook.gsromerolab.com`) **sem depender do PC do Guilherme ligado**.
>
> **Perfil do dono:** não-programador. Trabalhe de forma autônoma; confirme só antes de ações
> irreversíveis, que gastam dinheiro ou que afetam produção (trocar DNS, desligar o homelab).

---

## 0) Resultado esperado

- Frontend: build estático do Astro (`dist/`) servido pelo Pages.
- Backend: **Hono** em `functions/api/[[slug]].js` (todas as rotas `/api/*` num arquivo só).
- Banco: **D1** (`songbook-db`) substitui o `db/songbook.db` (node:sqlite). **Dados atuais migrados.**
- Auth: **JWT via `jose`** em cookie HttpOnly (substitui `express-session`). `bcryptjs` mantido.
- **NÃO precisa de R2** (não há upload de arquivos; os SVGs de acorde já são strings salvas no banco).
- O homelab (PM2 porta 4000) fica de pé como rollback até o usuário validar e mandar desligar.

---

## 1) Permissões e pré-requisitos

### O Codex precisa de permissão para:
- **Escrever arquivos** em `d:\Git\songbook`.
- **Executar no shell:** `git`, `pnpm`/`npm`, `node`, `npx wrangler`, `curl`.
- **Acesso à internet/rede** — para o `wrangler` falar com a API da Cloudflare, instalar dependências e testar os endpoints publicados.
- **`wrangler` autenticado** na conta Cloudflare do Guilherme. Verifique com `npx wrangler whoami`.
  - Se já houver outros projetos publicados (storetag/grimoire), provavelmente já está logado.
  - Se NÃO estiver: use `CLOUDFLARE_API_TOKEN` no ambiente (token com permissões **Pages: Edit** e **D1: Edit**), OU peça ao usuário rodar `wrangler login` (abre o navegador — passo humano).

### Só o usuário (humano) faz — PARE e peça quando chegar nesses pontos:
1. **`wrangler login`** (OAuth no navegador), se o `whoami` falhar.
2. **Domínio customizado** `songbook.gsromerolab.com`: hoje o DNS aponta para o homelab via Cloudflare Tunnel. Trocar para o Pages é feito no **dashboard** (Workers & Pages → projeto `songbook` → Custom domains) e **derruba a versão do homelab** para esse domínio — ação de produção, só com OK do usuário.
3. **Desligar o PM2** do homelab (`pm2 delete songbook` + tirar o ingress do `config.yml` do cloudflared) — só depois da validação.
4. Confirmar os **valores dos secrets** (são sensíveis).

> O Codex pode fazer TODO o resto (criar D1, escrever código, migrar dados, deploy num subdomínio `*.pages.dev` de teste) sem tocar no domínio de produção.

---

## 2) Mapa da migração (de → para)

| Homelab (hoje) | Cloudflare (destino) |
|---|---|
| Express + `routes/*.cjs` | Hono em `functions/api/[[slug]].js` |
| `node:sqlite` (`db/songbook.db`) | **D1** (`songbook-db`), API **assíncrona** |
| `express-session` + `db/sessionStore.cjs` | **JWT (`jose`)** em cookie HttpOnly |
| `bcryptjs` | `bcryptjs` (mantém — roda em Workers) |
| `services/chords.cjs` (SVG por string) | igual (sem DOM, compatível com Workers) |
| `services/cifraclub.cjs` (cheerio) | igual (cheerio roda em Workers) ⚠️ ver risco #1 |
| `services/gemini.cjs` | igual (`fetch` para a API do Gemini) |
| Astro `output: 'static'` → `dist/` | Pages serve `dist/`; páginas continuam buscando `/api/*` no cliente |
| PM2 porta 4000 | Pages (nuvem) |

**Tabelas a migrar** (do `db/songbook.db`): `users`, `musicas`, `favoritos`, `user_tom`, `user_transpose`, `historico`.
**NÃO migrar:** `sessions` (não há mais sessão) e `sqlite_sequence` (interna do SQLite).

---

## 3) Decisões específicas do songbook (já tomadas — siga-as)

- **Auth por cookie, não localStorage.** Diferente de storetag/grimoire (que usam token no header), o cliente do songbook é Astro estático com vários `fetch('/api/...')` simples baseados em cookie. Para mudar o MÍNIMO no frontend, o login deve gravar o JWT num **cookie HttpOnly** (`Secure; SameSite=Lax; Path=/`) e o middleware lê esse cookie. Como tudo é mesma origem, os `fetch` existentes continuam funcionando (cookie enviado automaticamente). Garanta `credentials: 'same-origin'` onde necessário.
- **Sem SSR / sem adapter Astro.** Manter `output: 'static'`. As páginas carregam dados via `fetch('/api/...')` no navegador (já é assim hoje). Não introduzir o adapter Cloudflare do Astro.
- **Sem R2.** Não há arquivos. Os diagramas de acorde são SVG em string salvos em `musicas.chord_svgs` (JSON).
- **Gemini mantido** (`GEMINI_API_KEY`). Se houver timeout/502 (como aconteceu no grimoire), considerar trocar por Groq depois — mas comece com Gemini.

### ⚠️ Riscos a verificar (avisar o usuário se acontecer)
1. **Scraping de IP de datacenter.** `searchCifraClub` (via Startpage) e `fetchCifra` (CifraClub) funcionam do homelab (IP residencial). Da Cloudflare (IP de datacenter) o Google/Startpage/CifraClub podem **bloquear ou exigir captcha**. Teste a importação após o deploy; se quebrar, é esperado — registrar como limitação e discutir alternativa (ex.: manter SÓ a importação num worker residencial, ou outra fonte).
2. **`db/songbook.db` é a fonte da verdade** das músicas (6 hoje), não os `.md`. Garanta que a migração de dados pegue o `.db`.

---

## 4) Passo a passo

### 4.1 Branch
```bash
cd d:\Git\songbook
git checkout -b feat/cloudflare-migration
```

### 4.2 Dependências
```bash
pnpm add hono jose
# bcryptjs, cheerio, @tombatossals/chords-db, @google/generative-ai já existem
```

### 4.3 Criar o banco D1
```bash
npx wrangler d1 create songbook-db
```
Copie o `database_id` retornado para o `wrangler.jsonc` (passo 4.4).

### 4.4 `wrangler.jsonc` (na raiz de `d:\Git\songbook`)
```jsonc
{
  "name": "songbook",
  "pages_build_output_dir": "dist",
  "compatibility_date": "2026-06-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    { "binding": "DB", "database_name": "songbook-db", "database_id": "<COLE_O_ID_AQUI>" }
  ]
}
```

### 4.5 Schema D1 — `migrations/0001_init.sql`
Recrie as tabelas (sem `sessions`/`sqlite_sequence`). Confira os tipos reais lendo `db/database.cjs` antes de finalizar:
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS musicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  artista TEXT,
  tom TEXT,
  tom_original TEXT,
  cifra TEXT,
  cifra_acordes TEXT,
  tags TEXT,            -- JSON
  link_cifraclub TEXT,
  link_youtube TEXT,
  chord_svgs TEXT,      -- JSON
  adicionado_por TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS favoritos (
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  PRIMARY KEY (user_id, slug)
);
CREATE TABLE IF NOT EXISTS user_tom (
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  tom TEXT,
  PRIMARY KEY (user_id, slug)
);
CREATE TABLE IF NOT EXISTS user_transpose (
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  offset INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, slug)
);
CREATE TABLE IF NOT EXISTS historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  visited_at TEXT DEFAULT (datetime('now'))
);
```
Aplicar:
```bash
npx wrangler d1 migrations apply songbook-db --remote
```

### 4.6 Backend Hono — `functions/api/[[slug]].js`
Porte **rota a rota** o que está em `routes/*.cjs` + `services/*.cjs`. Estrutura base:
```js
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const app = new Hono().basePath('/api')

// ---- auth helpers ----
async function makeToken(user, secret) {
  return new SignJWT({ uid: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d')
    .sign(new TextEncoder().encode(secret))
}
async function auth(c, next) {
  const token = getCookie(c, 'token')
  if (!token) return c.json({ error: 'Não autenticado' }, 401)
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode((c.env.JWT_SECRET||'').trim()))
    c.set('userId', payload.uid)
    await next()
  } catch { return c.json({ error: 'Token inválido' }, 401) }
}

// público
app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json().catch(()=>({}))
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first()
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return c.json({ error:'Credenciais inválidas' }, 401)
  const token = await makeToken(u, (c.env.JWT_SECRET||'').trim())
  setCookie(c, 'token', token, { httpOnly:true, secure:true, sameSite:'Lax', path:'/', maxAge:60*60*24*30 })
  return c.json({ ok:true, user:{ id:u.id, username:u.username } })
})
app.get('/auth/me', auth, async (c) => {
  const u = await c.env.DB.prepare('SELECT id, username FROM users WHERE id=?').bind(c.get('userId')).first()
  return u ? c.json(u) : c.json({ error:'não encontrado' }, 404)
})
app.post('/auth/logout', (c) => { deleteCookie(c, 'token', { path:'/' }); return c.json({ ok:true }) })

// protegidas (aplicar `auth`): /musicas, /favoritos, /transpose, /user-tom, /historico, /cifraclub/*
// ... portar de routes/*.cjs, trocando node:sqlite (síncrono) por D1 (assíncrono).

export const onRequest = handle(app)
```

**Lembretes de porte:**
- **D1 é assíncrono** (diferente do `node:sqlite` síncrono):
  ```js
  const row  = await c.env.DB.prepare('SELECT * FROM t WHERE id=?').bind(id).first()
  const { results } = await c.env.DB.prepare('SELECT * FROM t').all()
  await c.env.DB.prepare('INSERT INTO t (a,b) VALUES (?,?)').bind(a,b).run()
  ```
- Campos JSON (`tags`, `chord_svgs`): `JSON.stringify` ao gravar, `JSON.parse` ao ler.
- `services/chords.cjs`, `services/cifraclub.cjs`, `services/gemini.cjs`: copiar a lógica para dentro de `functions/` (ou um módulo importado por ele). Conferir que **não** usam `document`/`window`/`fs` — `chords.cjs` gera SVG por string (OK); `cifraclub.cjs` usa cheerio (OK); `gemini.cjs` usa `fetch` (trocar a lib `@google/generative-ai` por `fetch` direto à API REST do Gemini para evitar dependências de Node — mesmo padrão usado no grimoire/storetag).
- Ordem de rotas no Hono: específicas ANTES de genéricas (ex.: `/musicas/:slug` depois de rotas fixas).

### 4.7 Frontend (mudança mínima)
- Como o auth virou cookie HttpOnly de mesma origem, os `fetch('/api/...')` existentes seguem funcionando.
- Confira o `login`: a página de login deve `POST /api/auth/login` e, no sucesso, redirecionar (o cookie já é setado pela resposta).
- Remova qualquer dependência de resposta de sessão antiga, se houver.
- `output: 'static'` permanece. Build continua `pnpm build` → `dist/`.

### 4.8 Migrar os dados (`db/songbook.db` → D1)
Crie um script de export (roda local com Node 24, que tem `node:sqlite`):
```js
// scripts/export-to-d1.cjs
const { DatabaseSync } = require('node:sqlite')
const fs = require('fs')
const db = new DatabaseSync('db/songbook.db')
const esc = v => v === null || v === undefined ? 'NULL' : (typeof v === 'number' ? v : `'${String(v).replace(/'/g,"''")}'`)
const tables = {
  users: ['id','username','password_hash','created_at'],
  musicas: ['id','slug','titulo','artista','tom','tom_original','cifra','cifra_acordes','tags','link_cifraclub','link_youtube','chord_svgs','adicionado_por','created_at'],
  favoritos: ['user_id','slug'],
  user_tom: ['user_id','slug','tom'],
  user_transpose: ['user_id','slug','offset'],
  historico: ['id','user_id','slug','visited_at'],
}
let sql = ''
for (const [t, cols] of Object.entries(tables)) {
  for (const r of db.prepare(`SELECT ${cols.join(',')} FROM ${t}`).all()) {
    sql += `INSERT OR IGNORE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(c=>esc(r[c])).join(',')});\n`
  }
}
fs.writeFileSync('data-export.sql', sql)
console.log('Gerado data-export.sql')
```
```bash
node scripts/export-to-d1.cjs
npx wrangler d1 execute songbook-db --remote --file=data-export.sql
# Confirme:
npx wrangler d1 execute songbook-db --remote --command "SELECT COUNT(*) FROM musicas"
```
Depois **apague** `data-export.sql` e `scripts/export-to-d1.cjs` (continham dados/PII).

### 4.9 Secrets — ⚠️ use `printf` no bash, NUNCA `echo` no PowerShell
> `echo "x" | wrangler secret put` no PowerShell injeta um **BOM** que corrompe o valor e quebra headers (causa 500/502 difícil de achar). Use bash + `printf '%s'`.
```bash
# JWT_SECRET: gere um valor forte e ANOTE (se mudar depois, todos deslogam)
printf '%s' 'COLE_UM_SEGREDO_FORTE_AQUI' | npx wrangler pages secret put JWT_SECRET --project-name songbook
printf '%s' 'AIzaSyCg6WaQqTgkc-VMOds63Rc1Aq432te2544' | npx wrangler pages secret put GEMINI_API_KEY --project-name songbook
```
(O `SESSION_SECRET` antigo não é mais necessário.)

### 4.10 Build + deploy (subdomínio de teste primeiro)
```bash
pnpm build
npx wrangler pages deploy --project-name songbook --branch main --commit-dirty=true
```
Isso publica num `https://<hash>.songbook.pages.dev` — teste AÍ antes de mexer no domínio de produção.

### 4.11 Domínio customizado (PASSO HUMANO)
Só depois da validação: no dashboard Cloudflare → Workers & Pages → `songbook` → **Custom domains** → adicionar `songbook.gsromerolab.com`. Isso reaponta o domínio do homelab para o Pages. Em seguida, remover o ingress do songbook no `config.yml` do cloudflared e `pm2 delete songbook`.

---

## 5) Verificação (fazer após o deploy de teste)
Use a URL `*.pages.dev` do deploy:
```bash
BASE="https://<hash>.songbook.pages.dev"
# login (espera Set-Cookie e {ok:true})
curl -si -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"gsromero","password":"E5b2q9a7!20"}' | head -20
# guardando o cookie:
curl -s -c cookies.txt -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"username":"gsromero","password":"E5b2q9a7!20"}' >/dev/null
curl -s -b cookies.txt "$BASE/api/musicas" | head -c 300   # deve listar as 6 músicas
curl -s -b cookies.txt "$BASE/api/auth/me"                  # deve retornar o usuário
rm -f cookies.txt
```
Checklist:
- [ ] Login funciona e seta cookie HttpOnly.
- [ ] `/api/musicas` lista as músicas migradas (6).
- [ ] Abrir uma música: cifra, transpose, diagramas de acorde aparecem.
- [ ] Favoritar / salvar tom / transpose / histórico persistem (recarregar e conferir).
- [ ] Importar do CifraClub — **se falhar, é o risco #1 (IP de datacenter)**: anotar e avisar o usuário, não tratar como bug do código.
- [ ] **Testar login logo após CADA deploy** — se `JWT_SECRET` ficar vazio, todas as rotas autenticadas dão 500 (sintoma do erro de HMAC key length 0).

---

## 6) Rollback
O homelab continua intacto até o passo 4.11. Se algo falhar, basta não trocar o domínio — `songbook.gsromerolab.com` segue servindo o PM2 da porta 4000.

## 7) Armadilhas herdadas das migrações anteriores (não repetir)
- **Secret com BOM** (PowerShell `echo`) → 500/502. Sempre `printf` no bash + ler com `(c.env.X||'').trim()`.
- **JWT_SECRET vazio** → 500 em todas as rotas com auth. Testar login por curl após deploy.
- **D1 é assíncrono** — esquecer `await` retorna Promise, não dados.
- **Service Worker** (se algum dia virar PWA): `registerType:'autoUpdate'` não recarrega sozinho; o songbook hoje não é PWA, então ignorar.
- **Cloudflare cacheia 404** — para erros, responder com `Cache-Control: no-store` se necessário.
