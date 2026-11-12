import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { io as client } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachRealtime } from '../src/modules/chat/chat.socket.js';
import { createDatabase, checkDatabase } from '../src/config/database.js';
import { parseEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/passwords.js';
import { addDays, businessToday, dateInput } from '../src/modules/expiration/expiration.js';

const url = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV !== 'test' || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL || url.protocol !== 'mysql:' || !decodeURIComponent(url.pathname).endsWith('_test')) throw new Error('Use npm run test:db and an isolated *_test database.');
const database = createDatabase(url.href);
const config = parseEnv(process.env);
const companies = [];
const sessions = new Set();
const clients = [];
const password = 'Chat-seguro-prueba-2026';
let hash, app, server, realtime, address;
beforeAll(async () => { hash = await hashPassword(password); });
beforeEach(async () => {
  app = createApp({ config, database, checkDatabase: () => checkDatabase(database) });
  server = createServer(app);
  realtime = attachRealtime(server, { app, database, config });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  await new Promise(resolve => realtime.close(resolve));
});
afterAll(async () => {
  try {
    await database.session.deleteMany({ where: { id: { in: [...sessions] } } });
    await database.foodItem.deleteMany({ where: { companyId: { in: companies } } });
    await database.company.deleteMany({ where: { id: { in: companies } } });
  } finally { await database.$disconnect(); }
});
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out: ${name}`)); }, 4000);
    function listener(value) { if (!predicate(value)) return; clearTimeout(timer); socket.off(name, listener); resolve(value); }
    socket.on(name, listener);
  });
}
async function userFor(companyId, name = 'Persona de chat') {
  const user = await database.user.create({ data: { companyId, name, role: 'ADMIN', email: `chat-${randomUUID()}@tests.example`, passwordHash: hash } });
  let cookie;
  const agent = request.agent(app).use(test => test.on('response', response => {
    for (const value of response.headers['set-cookie'] || []) {
      cookie = value.split(';')[0];
      sessions.add(decodeURIComponent(cookie.slice('fwf.sid='.length)).slice(2).split('.')[0]);
    }
  }));
  const tokenFrom = response => response.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
  const token = tokenFrom(await agent.get('/auth/login'));
  expect((await agent.post('/auth/login').type('form').send({ _csrf: token, email: user.email, password })).status).toBe(303);
  const csrfToken = tokenFrom(await agent.get('/chat'));
  return { user, agent, cookie, csrfToken, sessionId: decodeURIComponent(cookie.slice('fwf.sid='.length)).slice(2).split('.')[0] };
}
async function fixture() {
  const company = await database.company.create({ data: { name: `Chat ${randomUUID()}`, rooms: { create: { name: 'General' } }, inventory: { create: { name: 'Principal' } }, categories: { create: { name: 'Fruta' } } }, include: { rooms: true, categories: true } });
  companies.push(company.id);
  return { company, roomId: company.rooms[0].id, ...await userFor(company.id) };
}
function makeClient(f, options = {}) {
  const socket = client(address, { autoConnect: false, forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: { Origin: config.APP_ORIGIN, Cookie: f.cookie }, auth: { csrfToken: f.csrfToken }, ...options });
  clients.push(socket);
  return socket;
}
async function connect(f, options) {
  const socket = makeClient(f, options);
  const ready = event(socket, 'chat:ready');
  socket.connect();
  expect((await ready).userId).toBe(f.user.id);
  return socket;
}
async function rejected(f, options) {
  const socket = makeClient(f, options);
  const failure = event(socket, 'connect_error');
  socket.connect();
  return failure;
}
const emit = (socket, name, input) => socket.timeout(4000).emitWithAck(name, input);
async function post(f, path, input) {
  const page = await f.agent.get('/account');
  const token = page.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
  return f.agent.post(path).type('form').send({ _csrf: token, ...input });
}

describe('Phase 4 real Socket.IO and isolated MySQL', () => {
  it('protects HTTP chat and rejects anonymous, forged-cookie and invalid-token handshakes', async () => {
    const anonymous = await request(app).get('/chat');
    for (const value of anonymous.headers['set-cookie'] || []) sessions.add(decodeURIComponent(value.split(';')[0].slice('fwf.sid='.length)).slice(2).split('.')[0]);
    expect(anonymous.headers.location).toBe('/auth/login');
    const f = await fixture();
    expect((await rejected(f, { extraHeaders: { Origin: config.APP_ORIGIN } })).message).toBe('AUTH_REQUIRED');
    expect((await rejected(f, { auth: { csrfToken: 'a'.repeat(64) } })).message).toBe('AUTH_REQUIRED');
    expect((await rejected(f, { extraHeaders: { Origin: config.APP_ORIGIN, Cookie: 'fwf.sid=forged' } })).message).toBe('AUTH_REQUIRED');
    const page = await f.agent.get('/chat');
    expect(page.status).toBe(200);
    expect(page.text).toContain('data-chat-room=');
    expect(page.text).toContain('href="/chat"');
  });
  it('rejects foreign/missing origins for WebSocket and polling; serves only local client assets', async () => {
    const f = await fixture();
    for (const transports of [['websocket'], ['polling']]) {
      for (const Origin of ['https://foreign.example', 'null', undefined]) {
        const headers = { Cookie: f.cookie, ...(Origin ? { Origin } : {}) };
        expect((await rejected(f, { transports, extraHeaders: headers })).message).toMatch(/error/);
      }
    }
    const asset = await request(server).get('/socket.io/socket.io.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['content-type']).toContain('javascript');
  });
  it('exchanges messages between two users, attributes identity server-side and persists across reconnects', async () => {
    const f = await fixture();
    const second = await userFor(f.company.id, 'Otra persona');
    const a = await connect(f), b = await connect(second);
    const live = event(b, 'chat:message');
    const result = await emit(a, 'chat:send', { roomId: f.roomId, content: '  Coordinar el inventario 🥬  ' });
    expect(result.ok).toBe(true);
    expect(await live).toEqual(result.message);
    expect(result.message.sender).toEqual({ id: f.user.id, name: f.user.name });
    expect(result.message.content).toBe('Coordinar el inventario 🥬');
    const saved = await database.chatMessage.findUniqueOrThrow({ where: { id: result.message.id } });
    expect(saved.companyId).toBe(f.company.id);
    expect(saved.userId).toBe(f.user.id);
    b.disconnect();
    const reconnected = await connect(second);
    expect((await emit(reconnected, 'chat:history', { roomId: f.roomId })).messages).toContainEqual(result.message);
    expect((await second.agent.get('/chat')).text).toContain('Coordinar el inventario 🥬');
  });
  it('isolates foreign rooms, cursors, live messages, history and client identity injection', async () => {
    const f = await fixture(), other = await fixture();
    const a = await connect(f), b = await connect(other);
    const received = [];
    b.on('chat:message', value => received.push(value));
    expect((await emit(a, 'chat:send', { roomId: other.roomId, content: 'Intento' })).code).toBe('FORBIDDEN');
    expect((await emit(a, 'chat:history', { roomId: other.roomId })).code).toBe('FORBIDDEN');
    expect((await emit(a, 'chat:send', { roomId: f.roomId, content: 'Intento', userId: other.user.id })).code).toBe('INVALID_INPUT');
    expect((await emit(a, 'chat:send', { roomId: f.roomId, content: 'Intento', companyId: other.company.id })).code).toBe('INVALID_INPUT');
    const result = await emit(a, 'chat:send', { roomId: f.roomId, content: 'Solo mi empresa' });
    expect((await emit(b, 'chat:history', { roomId: other.roomId, before: result.message.id })).code).toBe('FORBIDDEN');
    expect((await emit(b, 'chat:history', { roomId: other.roomId })).messages).toEqual([]);
    expect((await other.agent.get('/chat')).text).not.toContain('Solo mi empresa');
    expect(received).toEqual([]);
  });
  it('bounds and validates content and escapes stored HTML in HTTP history', async () => {
    const f = await fixture(), socket = await connect(f);
    for (const content of ['', '   ', 'a'.repeat(2001), 'bad\u0000text', 123, null]) {
      expect((await emit(socket, 'chat:send', { roomId: f.roomId, content })).code).toBe('INVALID_INPUT');
    }
    expect(await database.chatMessage.count({ where: { companyId: f.company.id } })).toBe(0);
    const payload = '<img src=x onerror="alert(1)">';
    expect((await emit(socket, 'chat:send', { roomId: f.roomId, content: payload })).ok).toBe(true);
    const page = await f.agent.get('/chat');
    expect(page.text).toContain('&lt;img');
    expect(page.text).not.toContain(payload);
    expect((await emit(socket, 'chat:send', { roomId: f.roomId, content: 'a'.repeat(2000) })).ok).toBe(true);
  });
  it('paginates stable history using a tenant-authorized cursor even for equal timestamps', async () => {
    const f = await fixture(), socket = await connect(f);
    const createdAt = new Date();
    await database.chatMessage.createMany({ data: Array.from({ length: 105 }, (_, i) => ({ companyId: f.company.id, roomId: f.roomId, userId: f.user.id, content: `Mensaje ${i}`, createdAt })) });
    const expected = await database.chatMessage.findMany({ where: { companyId: f.company.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    let before, ids = [];
    for (const size of [50, 50, 5]) {
      const page = await emit(socket, 'chat:history', { roomId: f.roomId, ...(before ? { before } : {}) });
      expect(page.ok).toBe(true);
      expect(page.messages).toHaveLength(size);
      expect(page.hasMore).toBe(size === 50);
      ids.push(...page.messages.slice().reverse().map(message => message.id));
      before = page.messages[0].id;
    }
    expect(ids).toEqual(expected.map(message => message.id));
    expect(new Set(ids).size).toBe(105);
    expect((await emit(socket, 'chat:history', { roomId: f.roomId, before: 'missing' })).code).toBe('FORBIDDEN');
  });
  it('reports distinct users, not tabs, and updates presence on disconnect with tenant isolation', async () => {
    const f = await fixture(), other = await fixture();
    const second = await userFor(f.company.id, 'Segunda persona');
    const a = await connect(f);
    const twoUsers = event(a, 'chat:presence', value => value.users.length === 2);
    const b = await connect(second);
    expect((await twoUsers).users.map(user => user.id).sort()).toEqual([f.user.id, second.user.id].sort());
    const tabs = event(a, 'chat:presence', value => value.users.length === 2);
    const extra = await connect(second);
    expect((await tabs).users).toHaveLength(2);
    await connect(other);
    const stillTwo = event(a, 'chat:presence', value => value.users.length === 2);
    extra.disconnect();
    await stillTwo;
    const one = event(a, 'chat:presence', value => value.users.length === 1);
    b.disconnect();
    expect((await one).users).toEqual([{ id: f.user.id, name: f.user.name }]);
  });
  it('supports HTTP polling fallback with authenticated live exchange', async () => {
    const f = await fixture(), second = await userFor(f.company.id);
    const a = await connect(f, { transports: ['polling'], upgrade: false, extraHeaders: { Cookie: f.cookie, 'Sec-Fetch-Site': 'same-origin' } });
    const b = await connect(second, { transports: ['polling'], upgrade: false });
    expect(a.io.engine.transport.name).toBe('polling');
    const live = event(b, 'chat:message');
    expect((await emit(a, 'chat:send', { roomId: f.roomId, content: 'Transporte alternativo' })).ok).toBe(true);
    expect((await live).content).toBe('Transporte alternativo');
  });
  it('limits concurrent connections per user and events per user across tabs', async () => {
    const f = await fixture();
    const sockets = [];
    for (let i = 0; i < 5; i++) sockets.push(await connect(f));
    expect((await rejected(f)).message).toBe('CONNECTION_LIMIT');
    for (let i = 0; i < 60; i++) expect((await emit(sockets[i % 5], 'chat:history', { roomId: f.roomId })).ok).toBe(true);
    expect((await emit(sockets[0], 'chat:send', { roomId: f.roomId, content: 'Demasiados' })).code).toBe('RATE_LIMIT');
    expect(await database.chatMessage.count({ where: { companyId: f.company.id } })).toBe(0);
  });
  it('revokes established sessions after logout before receiving or sending messages', async () => {
    const f = await fixture(), second = await userFor(f.company.id);
    const a = await connect(f), b = await connect(second);
    const received = [];
    a.on('chat:message', value => received.push(value));
    const disconnected = event(a, 'disconnect');
    expect((await post(f, '/auth/logout', {})).status).toBe(303);
    expect((await emit(b, 'chat:send', { roomId: f.roomId, content: 'Después de logout' })).ok).toBe(true);
    await disconnected;
    expect(received).toEqual([]);
    expect((await rejected(f)).message).toBe('AUTH_REQUIRED');
  });
  it('rejects expiration and password-version revocation on already-connected sockets', async () => {
    for (const cause of ['expiry', 'version']) {
      const f = await fixture(), socket = await connect(f);
      if (cause === 'expiry') await database.session.update({ where: { id: f.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      else await database.user.update({ where: { id: f.user.id }, data: { sessionVersion: { increment: 1 } } });
      const disconnected = event(socket, 'disconnect');
      expect((await emit(socket, 'chat:send', { roomId: f.roomId, content: 'No permitido' })).code).toBe('AUTH_REQUIRED');
      await disconnected;
      expect(await database.chatMessage.count({ where: { companyId: f.company.id } })).toBe(0);
    }
  });
  it('sends persisted inventory changes/near-expiry alerts only to the same company and skips invalid writes', async () => {
    const f = await fixture(), other = await fixture();
    const a = await connect(f), b = await connect(other);
    const foreign = [], own = [];
    b.on('inventory:changed', value => foreign.push(value));
    a.on('inventory:changed', value => own.push(value));
    const today = businessToday(config.BUSINESS_TIMEZONE);
    const input = { name: 'Manzana', quantity: '2.125', unit: 'kg', minimumStock: '1', categoryId: f.company.categories[0].id, receivedDate: dateInput(today), expiresDate: dateInput(addDays(today, 2)) };
    const created = event(a, 'inventory:changed');
    const response = await post(f, '/inventory', input);
    expect(response.status).toBe(303);
    const itemId = response.headers.location.split('/').at(-1);
    expect(await created).toMatchObject({ itemId, action: 'created', nearExpiry: true, expiration: 'critical', name: 'Manzana' });
    expect(String((await database.foodItem.findUniqueOrThrow({ where: { id: itemId } })).quantity)).toBe('2.125');
    const updated = event(a, 'inventory:changed');
    expect((await post(f, `/inventory/${itemId}/edit`, { ...input, expiresDate: dateInput(addDays(today, 10)) })).status).toBe(303);
    expect(await updated).toMatchObject({ action: 'updated', nearExpiry: false, expiration: 'normal' });
    expect((await post(f, '/inventory', { ...input, quantity: '-1' })).status).toBe(400);
    expect((await post(other, `/inventory/${itemId}/edit`, input)).status).toBe(404);
    const deleted = event(a, 'inventory:changed');
    expect((await post(f, `/inventory/${itemId}/delete`, { confirm: 'yes' })).status).toBe(303);
    expect(await deleted).toMatchObject({ itemId, action: 'deleted' });
    expect(own).toHaveLength(3);
    expect(foreign).toEqual([]);
  });
  it('returns safe database errors without broadcasting an unpersisted message', async () => {
    const f = await fixture(), socket = await connect(f);
    const sent = [];
    socket.on('chat:message', value => sent.push(value));
    const failure = vi.spyOn(database.chatMessage, 'create').mockRejectedValueOnce(new Error('Private database diagnostic mysql://secret@example/database'));
    let result;
    try { result = await emit(socket, 'chat:send', { roomId: f.roomId, content: 'No se guarda' }); }
    finally { failure.mockRestore(); }
    expect(result).toEqual({ ok: false, code: 'CHAT_UNAVAILABLE', message: 'No se pudo completar la solicitud.' });
    expect(sent).toEqual([]);
    expect(await database.chatMessage.count({ where: { companyId: f.company.id } })).toBe(0);
  });
  it('closes the shared HTTP server and established sockets without a hanging transport', async () => {
    const f = await fixture(), socket = await connect(f);
    const disconnected = event(socket, 'disconnect');
    await new Promise(resolve => realtime.close(resolve));
    await disconnected;
    expect(server.listening).toBe(false);
    expect(realtime.io.engine.clientsCount).toBe(0);
  });
});
