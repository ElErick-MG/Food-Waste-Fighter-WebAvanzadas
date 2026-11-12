import session from 'express-session';

// Sessions survive process restarts; no in-memory fallback is used.
export class PrismaSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
  }
  get(id, callback) {
    this.database.session.findUnique({ where: { id } }).then(async row => {
      if (!row) return null;
      if (row.expiresAt <= new Date()) {
        await this.database.session.deleteMany({ where: { id, expiresAt: { lte: new Date() } } });
        return null;
      }
      return row.data;
    }).then(data => callback(null, data), callback);
  }
  set(id, value, callback = () => {}) {
    const data = JSON.parse(JSON.stringify(value));
    const record = {
      data,
      userId: value.auth?.userId || null,
      expiresAt: new Date(value.cookie.expires || Date.now() + 8 * 60 * 60 * 1000),
    };
    this.database.session.upsert({ where: { id }, create: { id, ...record }, update: record })
      .then(() => callback(), callback);
  }
  destroy(id, callback = () => {}) {
    this.database.session.deleteMany({ where: { id } }).then(() => callback(), callback);
  }
  touch(id, value, callback = () => {}) {
    this.database.session.updateMany({
      where: { id }, data: { expiresAt: new Date(value.cookie.expires) },
    }).then(() => callback(), callback);
  }
}
