const PUBLIC_PATHS = ['/login', '/login/'];

function requireAuth(req, res, next) {
  // Rotas públicas
  if (PUBLIC_PATHS.includes(req.path)) return next();

  if (req.session && req.session.userId) {
    return next();
  }
  // API requests → 401 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  // Page requests → redirect to login
  res.redirect('/login');
}

module.exports = { requireAuth };
