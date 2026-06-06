// Smoke test do Songbook — valida o app inteiro em 1 comando.
//
// Uso (PowerShell):
//   $env:SMOKE_PASS="<senha>"; node scripts/smoke.mjs https://songbook.gsromerolab.com
// Uso (bash):
//   SMOKE_PASS='<senha>' node scripts/smoke.mjs https://songbook.gsromerolab.com
//
// Cria uma música de teste, confere geração de acordes, e APAGA no fim (self-cleaning).
// Sai com código 0 se tudo passar, 1 se algo falhar.

const BASE = (process.argv[2] || '').replace(/\/$/, '')
const USER = process.env.SMOKE_USER || 'gsromero'
const PASS = process.env.SMOKE_PASS || ''

if (!BASE) { console.error('Falta a URL base. Ex: node scripts/smoke.mjs https://songbook.gsromerolab.com'); process.exit(1) }
if (!PASS) { console.error('Falta SMOKE_PASS no ambiente (a senha do usuário).'); process.exit(1) }

let cookie = ''
const fails = []
const ok = (cond, label, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); if (!cond) fails.push(label) }

async function call(method, path, body, raw) {
  const headers = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = cookie
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  const sc = res.headers.get('set-cookie')
  if (sc) cookie = sc.split(';')[0]
  if (raw) return { status: res.status, text: await res.text() }
  let data = null; try { data = await res.json() } catch {}
  return { status: res.status, data }
}

console.log(`\n🔎 Smoke test → ${BASE}\n`)

// 1. Login
const login = await call('POST', '/api/auth/login', { username: USER, password: PASS })
ok(login.status === 200 && login.data?.ok, '1) Login (cookie JWT)', `HTTP ${login.status}`)

// 2. Listar músicas
const before = await call('GET', '/api/musicas')
const baseCount = Array.isArray(before.data) ? before.data.length : -1
ok(Array.isArray(before.data), '2) GET /api/musicas', `${baseCount} músicas`)

// 3. Importar música de teste (cifra colada)
const cifra = '[Intro] C G Am F\n\nC            G\nSmoke test importacao\nAm           F\nGeracao automatica de acordes'
const created = await call('POST', '/api/musicas', {
  titulo: 'ZZ Smoke Test', artista: 'QA Bot', tom: 'C', tom_original: 'C',
  tags: ['smoke'], cifra, link_cifraclub: '', link_youtube: ''
})
const slug = created.data?.slug
ok(created.status === 200 && !!slug, '3) Importar (POST /api/musicas)', created.data?.error || `slug ${slug}`)

// 4. Conferir geração dos diagramas de acorde
if (slug) {
  const got = await call('GET', '/api/musicas/' + slug)
  const sv = got.data?.chord_svgs || {}
  const temSvg = JSON.stringify(sv).includes('<svg')
  ok(temSvg && Object.keys(sv).length > 0, '4) Acordes gerados (SVG)', Object.keys(sv).join(', ') || 'nenhum')
}

// 5. Conferir HTML novo da home (sob auth)
const home = await call('GET', '/', null, true)
const html = home.text || ''
ok(html.includes('repertorio-shell') && html.includes('card-grid'), '5) HTML do Repertório carregou')

// 6. Limpeza: apagar a música de teste
if (slug) {
  const del = await call('DELETE', '/api/musicas/' + slug)
  if (del.status >= 200 && del.status < 300) {
    ok(true, '6) Limpeza (DELETE)', `HTTP ${del.status}`)
  } else {
    ok(false, '6) Limpeza (DELETE)', `HTTP ${del.status} — rota de delete pode não existir`)
    console.log(`   ⚠ Remova manualmente: wrangler d1 execute songbook-db --remote --command "DELETE FROM musicas WHERE slug='${slug}'"`)
  }
  const after = await call('GET', '/api/musicas')
  const finalCount = Array.isArray(after.data) ? after.data.length : -1
  ok(finalCount === baseCount, '7) Contagem voltou ao normal', `${finalCount} (esperado ${baseCount})`)
}

console.log('')
if (fails.length) { console.log(`❌ FALHOU: ${fails.length} problema(s) — ${fails.join(' | ')}`); process.exit(1) }
console.log('✅ PASSOU: tudo certo.'); process.exit(0)
