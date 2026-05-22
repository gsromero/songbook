const { getDb } = require('./database.cjs');

// Session store customizado usando better-sqlite3
// Compatível com a interface do express-session

class BetterSqliteStore {
  constructor(session) {
    this.Store = session.Store;
    Object.setPrototypeOf(BetterSqliteStore.prototype, this.Store.prototype);
    // Limpar sessões expiradas a cada 10 minutos
    setInterval(() => this.clearExpired(), 10 * 60 * 1000);
  }

  get(sid, cb) {
    try {
      const row = getDb().prepare('SELECT sess, expired FROM sessions WHERE sid = ?').get(sid);
      if (!row) return cb(null, null);
      if (Date.now() > row.expired) {
        this.destroy(sid, () => {});
        return cb(null, null);
      }
      return cb(null, JSON.parse(row.sess));
    } catch (err) { return cb(err); }
  }

  set(sid, session, cb) {
    try {
      const maxAge = (session.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000);
      const expired = Date.now() + maxAge;
      const sess = JSON.stringify(session);
      getDb().prepare(`
        INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
        ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
      `).run(sid, sess, expired);
      return cb?.(null);
    } catch (err) { return cb?.(err); }
  }

  destroy(sid, cb) {
    try {
      getDb().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      return cb?.(null);
    } catch (err) { return cb?.(err); }
  }

  touch(sid, session, cb) {
    return this.set(sid, session, cb);
  }

  clearExpired() {
    try { getDb().prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now()); } catch {}
  }
}

module.exports = BetterSqliteStore;
