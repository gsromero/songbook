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
  artista TEXT NOT NULL,
  tom TEXT,
  tom_original TEXT,
  tags TEXT DEFAULT '[]',
  cifra TEXT,
  chord_svgs TEXT DEFAULT '{}',
  link_cifraclub TEXT DEFAULT '',
  link_youtube TEXT DEFAULT '',
  adicionado_por INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favoritos (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  musica_slug TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, musica_slug)
);

CREATE TABLE IF NOT EXISTS user_tom (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  musica_slug TEXT NOT NULL,
  tom TEXT NOT NULL,
  PRIMARY KEY (user_id, musica_slug)
);

CREATE TABLE IF NOT EXISTS user_transpose (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  musica_slug TEXT NOT NULL,
  offset INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, musica_slug)
);

CREATE TABLE IF NOT EXISTS historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  musica_slug TEXT NOT NULL,
  acessado_em TEXT DEFAULT (datetime('now'))
);
