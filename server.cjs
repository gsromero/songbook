require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const BetterSqliteStore = require('./db/sessionStore.cjs');

const { initDb } = require('./db/database.cjs');
const { seed } = require('./db/seed.cjs');
const { requireAuth } = require('./middleware/auth.cjs');

const authRoutes = require('./routes/auth.cjs');
const musicasRoutes = require('./routes/musicas.cjs');
const favoritosRoutes = require('./routes/favoritos.cjs');
const userTomRoutes = require('./routes/user-tom.cjs');
const transposeRoutes = require('./routes/transpose.cjs');
const historicoRoutes = require('./routes/historico.cjs');
const cifraclubRoutes = require('./routes/cifraclub.cjs');

const app = express();
const PORT = process.env.PORT || 4000;
const DIST = path.join(__dirname, 'dist');

// ── Inicializar banco de dados ────────────────────────────────────────────────
initDb();
seed().catch(err => console.error('[seed] Erro:', err));

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new BetterSqliteStore(session),
  secret: process.env.SESSION_SECRET || 'songbook-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// ── Rotas públicas ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// Página de login — pública, antes do requireAuth
app.get(['/login', '/login/'], (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.sendFile(path.join(DIST, 'login', 'index.html'), err => {
    if (err) res.status(404).send('Login page not found — run pnpm build');
  });
});

// ── Auth middleware (protege tudo abaixo) ─────────────────────────────────────
app.use(requireAuth);

// ── Rotas protegidas (API) ────────────────────────────────────────────────────
app.use('/api/musicas', musicasRoutes);
app.use('/api/favoritos', favoritosRoutes);
app.use('/api/user-tom', userTomRoutes);
app.use('/api/transpose', transposeRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/cifraclub', cifraclubRoutes);

// ── Arquivos estáticos do build Astro ─────────────────────────────────────────
app.use(express.static(DIST, { extensions: ['html'] }));

// Todas as rotas /musica/* → shell da cifra
app.get('/musica/*path', (req, res) => {
  res.sendFile(path.join(DIST, 'musica', 'index.html'), err => {
    if (err) res.status(404).send('Música não encontrada');
  });
});

// SPA fallback
app.get('/*path', (req, res) => {
  res.sendFile(path.join(DIST, '404.html'), err => {
    if (err) res.status(404).send('Página não encontrada');
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Songbook rodando na porta ${PORT}`);
});
