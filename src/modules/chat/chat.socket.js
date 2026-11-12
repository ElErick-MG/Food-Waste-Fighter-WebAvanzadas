import { Server } from 'socket.io';
import { timingSafeEqual } from 'node:crypto';
import { createChatService, historySchema, messageSchema } from './chat.service.js';
import { BusinessError } from '../business.js';
import { businessToday, expiration } from '../expiration/expiration.js';

const tokenMatches = (value, expected) => typeof value === 'string' && typeof expected === 'string' &&
  Buffer.byteLength(value) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
export function socketOriginAllowed(request, config) {
  const site = request.headers['sec-fetch-site'];
  if (site === 'cross-site' || site === 'same-site') return false;
  if (request.headers.origin === new URL(config.APP_ORIGIN).origin) return true;
  // Same-origin polling GETs in Chromium omit Origin. Fetch Metadata is
  // browser-controlled; foreign sites cannot label requests same-origin.
  if (!request.headers.origin && site === 'same-origin' && request._query?.transport === 'polling') return true;
  // Same bounded proxy rule used by HTTP forms, plus a session-bound token at
  // namespace authentication. Do not trust forwarded host/origin alone.
  return config.trustProxy === 1 && new URL(config.APP_ORIGIN).protocol === 'https:' &&
    request.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https' && site === 'same-origin';
}

export function attachRealtime(server, { app, database, config }) {
  const service = createChatService(database);
  const io = new Server(server, {
    maxHttpBufferSize: 16 * 1024, connectTimeout: 10000,
    allowRequest: (req, done) => done(null, socketOriginAllowed(req, config)),
  });
  // Reuse the exact Express middleware/store/secret/cookie configuration. Only
  // the Engine.IO handshake needs it; socket events never save stale sessions.
  io.engine.use((req, res, next) => req._query.sid ? next() : app.locals.sessionMiddleware(req, res, next));
  const sockets = new Map();
  const rates = new Map();
  let closing = false;
  async function activeUser(socket) {
    const sessionId = socket.request.sessionID;
    const row = sessionId && await database.session.findUnique({ where: { id: sessionId } });
    const auth = row?.data?.auth;
    if (!row || row.expiresAt <= new Date() || !auth) return null;
    const user = await database.user.findUnique({ where: { id: auth.userId }, select: { id: true, name: true, companyId: true, sessionVersion: true } });
    if (!user || user.sessionVersion !== auth.version) return null;
    const initial = socket.data.user;
    if (initial && (initial.id !== user.id || initial.companyId !== user.companyId)) return null;
    return user;
  }
  io.use(async (socket, next) => {
    try {
      if (!tokenMatches(socket.handshake.auth?.csrfToken, socket.request.session?.csrfToken)) return next(new Error('AUTH_REQUIRED'));
      const user = await activeUser(socket);
      if (!user) return next(new Error('AUTH_REQUIRED'));
      const room = await service.general(user.companyId);
      const connected = [...sockets.values()];
      if (connected.filter(s => s.data.user.id === user.id).length >= 5 || connected.filter(s => s.data.user.companyId === user.companyId).length >= 100) return next(new Error('CONNECTION_LIMIT'));
      socket.data.user = user;
      socket.data.roomId = room.id;
      next();
    } catch { next(new Error('CHAT_UNAVAILABLE')); }
  });
  async function recipients(companyId) {
    const result = [];
    for (const socket of sockets.values()) {
      if (socket.data.user.companyId !== companyId) continue;
      try {
        const user = await activeUser(socket);
        if (user) { socket.data.user = user; result.push(socket); }
        else socket.disconnect(true);
      } catch { socket.disconnect(true); }
    }
    return result;
  }
  async function broadcast(companyId, event, value) {
    for (const socket of await recipients(companyId)) socket.emit(event, value);
  }
  async function presence(companyId) {
    const connected = await recipients(companyId);
    const users = [...new Map(connected.map(socket => [socket.data.user.id, { id: socket.data.user.id, name: socket.data.user.name }])).values()];
    users.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    for (const socket of connected) socket.emit('chat:presence', { users });
  }
  function consume(userId) {
    const now = Date.now();
    let rate = rates.get(userId);
    if (!rate || now >= rate.until) { rate = { count: 0, until: now + 60000 }; rates.set(userId, rate); }
    return ++rate.count <= 60;
  }
  io.on('connection', socket => {
    sockets.set(socket.id, socket);
    socket.join(`company:${socket.data.user.companyId}`);
    socket.emit('chat:ready', { roomId: socket.data.roomId, userId: socket.data.user.id });
    void presence(socket.data.user.companyId);
    function handle(event, schema, action) {
      socket.on(event, async (input, ack) => {
        if (typeof ack !== 'function') return;
        const reply = value => { if (socket.connected) ack(value); };
        try {
          if (!consume(socket.data.user.id)) return reply({ ok: false, code: 'RATE_LIMIT', message: 'Espera un minuto antes de continuar.' });
          const user = await activeUser(socket);
          if (!user) { reply({ ok: false, code: 'AUTH_REQUIRED', message: 'La sesión caducó. Inicia sesión de nuevo.' }); socket.disconnect(true); return; }
          socket.data.user = user;
          const parsed = schema.safeParse(input);
          if (!parsed.success) return reply({ ok: false, code: 'INVALID_INPUT', message: 'Revisa la sala y el mensaje (1–2000 caracteres).' });
          reply({ ok: true, ...await action(user, parsed.data) });
        } catch (error) {
          reply({ ok: false, code: error instanceof BusinessError ? 'FORBIDDEN' : 'CHAT_UNAVAILABLE', message: 'No se pudo completar la solicitud.' });
        }
      });
    }
    handle('chat:history', historySchema, async (user, input) => service.history(user.companyId, input));
    handle('chat:send', messageSchema, async (user, input) => {
      const message = await service.send(user, input);
      await broadcast(user.companyId, 'chat:message', message);
      return { message };
    });
    socket.on('disconnect', () => {
      sockets.delete(socket.id);
      if (!closing) void presence(socket.data.user.companyId);
    });
  });
  const timer = setInterval(() => {
    for (const [id, value] of rates) if (Date.now() >= value.until) rates.delete(id);
    for (const companyId of new Set([...sockets.values()].map(socket => socket.data.user.companyId))) void presence(companyId);
  }, 15000);
  timer.unref();
  const realtime = {
    io,
    async inventoryChanged(companyId, itemId, action) {
      try {
        const item = action === 'deleted' ? null : await database.foodItem.findFirst({ where: { companyId, id: itemId }, select: { name: true, expiresDate: true } });
        const state = item && expiration(item.expiresDate, businessToday(config.BUSINESS_TIMEZONE));
        await broadcast(companyId, 'inventory:changed', { itemId, action, name: item?.name || null, expiration: state?.code || null, nearExpiry: Boolean(state && state.days >= 0 && state.days <= 5) });
      } catch {
        // A committed HTTP mutation must not become a misleading error if the
        // optional live delivery fails. The persisted inventory stays authoritative.
        console.warn('Inventory live notification unavailable.');
      }
    },
    close(callback) { closing = true; clearInterval(timer); io.close(callback); },
  };
  app.locals.realtime = realtime;
  return realtime;
}
