import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDatabase, checkDatabase } from '../src/config/database.js';
import { parseEnv } from '../src/config/env.js';
import { hashToken, createAuthService } from '../src/modules/auth/auth.service.js';

const url = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV !== 'test' || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
    url.protocol !== 'mysql:' || !decodeURIComponent(url.pathname).endsWith('_test')) {
  throw new Error('Run npm run test:db with an isolated *_test database.');
}
const database = createDatabase(url.href);
const config = parseEnv(process.env);
const companyIds = [];
const sessionIds = new Set();
const password = 'Semilla-prueba-segura-2026';
let app;
let mailbox;
const makeApp = (settings = config) => createApp({ config: settings, database, checkDatabase: () => checkDatabase(database), sendResetMail: async mail => mailbox.push(mail) });
beforeEach(() => { mailbox = []; app = makeApp(); });
afterAll(async () => {
  try {
    await database.session.deleteMany({ where: { id: { in: [...sessionIds] } } });
    await database.foodItem.deleteMany({ where: { companyId: { in: companyIds } } });
    await database.company.deleteMany({ where: { id: { in: companyIds } } });
  } finally { await database.$disconnect(); }
});
function remember(response) {
  for (const cookie of response.headers['set-cookie'] || []) {
    const signed = decodeURIComponent(cookie.split(';')[0].slice('fwf.sid='.length));
    if (signed.startsWith('s:')) sessionIds.add(signed.slice(2).split('.')[0]);
  }
  return response;
}
const trackedAgent = instance => request.agent(instance).use(test => test.on('response', remember));
async function csrf(agent, path = '/auth/login') {
  const response = remember(await agent.get(path));
  expect(response.status).toBe(200);
  const match = response.text.match(/name="_csrf" value="([a-f0-9]{64})"/);
  expect(match).not.toBeNull();
  return match[1];
}
async function post(agent, path, fields, token) {
  return remember(await agent.post(path).type('form').send({ ...fields, _csrf: token }));
}
async function account(overrides = {}, instance = app) {
  const agent = trackedAgent(instance);
  const email = `auth-${randomUUID()}@tests.example`;
  const input = { name: 'Persona de prueba', email, password, confirmPassword: password, companyName: `Negocio ${randomUUID()}`, ...overrides };
  const before = await csrf(agent, '/auth/register');
  const response = await post(agent, '/auth/register', input, before);
  expect(response.status).toBe(303);
  const user = await database.user.findUniqueOrThrow({ where: { email: input.email.trim().toLowerCase() } });
  companyIds.push(user.companyId);
  return { agent, user, response, input };
}
async function login(agent, email, value = password) {
  return post(agent, '/auth/login', { email, password: value }, await csrf(agent));
}
async function resetLink(agent, email) {
  const response = await post(agent, '/auth/forgot', { email }, await csrf(agent, '/auth/forgot'));
  expect(response.status).toBe(200);
  return new URL(mailbox.at(-1).link).searchParams.get('token');
}
async function reset(agent, token, nextPassword = 'Nueva-semilla-segura-2026') {
  return post(agent, '/auth/reset', { token, password: nextPassword, confirmPassword: nextPassword }, await csrf(agent, `/auth/reset?token=${token}`));
}

describe('Phase 2 real MySQL authentication and tenant boundaries', () => {
  it('registers atomically, normalizes email, hashes Argon2id and creates tenant defaults', async () => {
    const email = `  Upper-${randomUUID()}@Tests.Example  `;
    const { user, response, agent } = await account({ email });
    expect(user.email).toBe(email.trim().toLowerCase());
    expect(user.role).toBe('ADMIN');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(password);
    expect(await database.inventory.count({ where: { companyId: user.companyId } })).toBe(1);
    expect(await database.chatRoom.count({ where: { companyId: user.companyId, name: 'General' } })).toBe(1);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect((await agent.get('/dashboard')).status).toBe(200);
  });
  it('rejects duplicate email and rolls back the attempted company and defaults', async () => {
    const { input } = await account();
    const count = await database.company.count();
    const agent = trackedAgent(app);
    const response = await post(agent, '/auth/register', { ...input, email: input.email.toUpperCase() }, await csrf(agent, '/auth/register'));
    expect(response.status).toBe(409);
    expect(await database.company.count()).toBe(count);
  });
  it('rejects weak passwords, confirmation mismatch and public tenant/role injection', async () => {
    const agent = trackedAgent(app);
    const token = await csrf(agent, '/auth/register');
    const base = { name: 'Nombre', email: `invalid-${randomUUID()}@tests.example`, companyName: 'Negocio', password, confirmPassword: password };
    for (const extra of [{ password: 'short', confirmPassword: 'short' }, { confirmPassword: 'different' }, { role: 'ADMIN', companyId: 'foreign' }]) {
      expect((await post(agent, '/auth/register', { ...base, ...extra }, token)).status).toBe(400);
    }
    expect(await database.user.findUnique({ where: { email: base.email } })).toBeNull();
  });
  it('protects account/team routes and rejects GET logout', async () => {
    const agent = trackedAgent(app);
    for (const path of ['/dashboard', '/team']) expect((await agent.get(path)).headers.location).toBe('/auth/login');
    expect((await agent.get('/auth/logout')).status).toBe(404);
  });
  it('rotates the anonymous session on login and destroys it on POST logout', async () => {
    const { user } = await account();
    const agent = trackedAgent(app);
    const anonymous = remember(await agent.get('/auth/login')).headers['set-cookie'][0].split(';')[0];
    const response = await login(agent, user.email);
    expect(response.status).toBe(303);
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    expect(cookie).not.toBe(anonymous);
    expect((await request(app).get('/dashboard').on('response', remember).set('Cookie', anonymous)).headers.location).toBe('/auth/login');
    const logout = await post(agent, '/auth/logout', {}, await csrf(agent, '/dashboard'));
    expect(logout.status).toBe(303);
    expect((await request(app).get('/dashboard').on('response', remember).set('Cookie', cookie)).headers.location).toBe('/auth/login');
  });
  it('uses the same generic login error for unknown email and wrong password', async () => {
    const { user } = await account();
    const agent = trackedAgent(app);
    const wrong = await login(agent, user.email, 'incorrecta');
    const unknown = await login(agent, `unknown-${randomUUID()}@tests.example`, 'incorrecta');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    for (const response of [wrong, unknown]) expect(response.text).toContain('El correo o la contraseña no son correctos.');
  });
  it('persists sessions across application instances and rejects expired sessions', async () => {
    const { response, user } = await account();
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    const otherInstance = makeApp();
    expect((await request(otherInstance).get('/dashboard').set('Cookie', cookie)).status).toBe(200);
    await database.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    const expired = remember(await request(otherInstance).get('/dashboard').set('Cookie', cookie));
    expect(expired.headers.location).toBe('/auth/login');
  });
  it('requires CSRF and same-origin mutations, including multibyte invalid tokens', async () => {
    const agent = trackedAgent(app);
    const token = await csrf(agent);
    expect((await agent.post('/auth/logout').type('form').send({})).status).toBe(403);
    expect((await post(agent, '/auth/logout', {}, 'ñ'.repeat(64))).status).toBe(403);
    expect((await agent.post('/auth/logout').set('Origin', 'https://attacker.example').type('form').send({ _csrf: token })).status).toBe(403);
    expect((await agent.post('/auth/logout').set('Sec-Fetch-Site', 'cross-site').type('form').send({ _csrf: token })).status).toBe(403);
  });
  it('distinguishes rejected forms without revealing credentials or session/token values', async () => {
    const agent = trackedAgent(app);
    const token = await csrf(agent);
    const secret = 'private-password-not-for-output';
    const missingCookie = remember(await request(app).post('/auth/login').type('form').send({ _csrf: token, password: secret }));
    expect(missingCookie.text).toContain('FWF_SESSION_COOKIE_MISSING');
    const unknownSession = remember(await request(app).post('/auth/login').set('Cookie', 'fwf.sid=s%3Ainvalid.invalid').type('form').send({ _csrf: token, password: secret }));
    expect(unknownSession.text).toContain('FWF_SESSION_UNAVAILABLE');
    const wrongToken = await post(agent, '/auth/login', { password: secret }, '0'.repeat(64));
    expect(wrongToken.text).toContain('FWF_FORM_TOKEN_CHANGED');
    const missingToken = await agent.post('/auth/login').type('form').send({ password: secret });
    expect(missingToken.text).toContain('FWF_FORM_TOKEN_MISSING');
    const origin = await agent.post('/auth/login').set('Origin', 'https://other.example').type('form').send({ _csrf: token, password: secret });
    expect(origin.text).toContain('FWF_FORM_ORIGIN_REJECTED');
    for (const response of [missingCookie, unknownSession, wrongToken, missingToken, origin]) {
      expect(response.status).toBe(403);
      expect(response.text).not.toContain(secret);
      expect(response.text).not.toContain(token);
      expect(response.text).not.toContain(config.SESSION_SECRET);
    }
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const developmentApp = makeApp(parseEnv({ ...process.env, NODE_ENV: 'development' }));
      remember(await request(developmentApp).post('/auth/login?token=private-query-value')
        .type('form').send({ _csrf: token, password: secret }));
      expect(warning).toHaveBeenCalledOnce();
      const logged = warning.mock.calls[0][0];
      expect(JSON.parse(logged)).toMatchObject({ event: 'form_rejected', code: 'FWF_SESSION_COOKIE_MISSING' });
      for (const privateValue of [secret, token, config.SESSION_SECRET, 'private-query-value']) {
        expect(logged).not.toContain(privateValue);
      }
    } finally { warning.mockRestore(); }
  });
  it('supports native no-referrer form navigation while rejecting opaque cross-site requests', async () => {
    const agent = trackedAgent(app);
    const token = await csrf(agent);
    const denied = await agent.post('/auth/logout').set('Origin', 'null').set('Sec-Fetch-Site', 'cross-site').type('form').send({ _csrf: token });
    expect(denied.status).toBe(403);
    const native = await agent.post('/auth/logout').set('Origin', 'null').set('Sec-Fetch-Site', 'same-origin').type('form').send({ _csrf: token });
    expect(native.status).toBe(303);
  });
  it('sets Secure cookies over the trusted HTTPS forwarding configuration', async () => {
    const httpsApp = makeApp(parseEnv({ ...process.env, APP_ORIGIN: 'https://demo.app.github.dev', TRUST_PROXY: '1' }));
    const response = remember(await request(httpsApp).get('/auth/login').set('X-Forwarded-Proto', 'https'));
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('; Secure');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('logs in and out through trusted HTTPS when the proxy omits Fetch Metadata', async () => {
    const { user } = await account();
    const httpsApp = makeApp(parseEnv({ ...process.env, APP_ORIGIN: 'https://demo.app.github.dev', TRUST_PROXY: '1' }));
    const form = remember(await request(httpsApp).get('/auth/login').set('X-Forwarded-Proto', 'https'));
    const anonymousCookie = form.headers['set-cookie'][0].split(';')[0];
    const token = form.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
    const withoutCookie = remember(await request(httpsApp).post('/auth/login')
      .set('X-Forwarded-Proto', 'https').set('Origin', 'null')
      .type('form').send({ _csrf: token, email: user.email, password }));
    expect(withoutCookie.status).toBe(403);
    const invalidToken = await request(httpsApp).post('/auth/login')
      .set('X-Forwarded-Proto', 'https').set('Origin', 'null').set('Cookie', anonymousCookie)
      .type('form').send({ _csrf: '0'.repeat(64), email: user.email, password });
    expect(invalidToken.status).toBe(403);
    const response = remember(await request(httpsApp).post('/auth/login')
      .set('X-Forwarded-Proto', 'https').set('Origin', 'null').set('Cookie', anonymousCookie)
      .type('form').send({ _csrf: token, email: user.email, password }));
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/dashboard');
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    expect(cookie).not.toBe(anonymousCookie);
    expect(response.headers['set-cookie'][0]).toContain('; Secure');
    const dashboard = remember(await request(httpsApp).get('/dashboard').set('X-Forwarded-Proto', 'https').set('Cookie', cookie));
    expect(dashboard.status).toBe(200);
    const csrf = dashboard.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
    const logout = await request(httpsApp).post('/auth/logout')
      .set('X-Forwarded-Proto', 'https').set('Origin', 'null').set('Cookie', cookie)
      .type('form').send({ _csrf: csrf });
    expect(logout.status).toBe(303);
    expect((await request(httpsApp).get('/dashboard').on('response', remember).set('X-Forwarded-Proto', 'https').set('Cookie', cookie)).headers.location).toBe('/auth/login');
  });
  it('accepts a proxy-rewritten Origin only with trusted HTTPS, browser same-origin metadata and a session token', async () => {
    const { user } = await account();
    const httpsApp = makeApp(parseEnv({ ...process.env, APP_ORIGIN: 'https://demo.app.github.dev', TRUST_PROXY: '1' }));
    const form = remember(await request(httpsApp).get('/auth/login').set('X-Forwarded-Proto', 'https'));
    const cookie = form.headers['set-cookie'][0].split(';')[0];
    const token = form.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
    const send = ({ instance = httpsApp, forwardedHttps = true, site = 'same-origin', cookieValue = cookie, tokenValue = token } = {}) => {
      const attempt = request(instance).post('/auth/login').set('Origin', 'http://upstream.internal:3000').set('Sec-Fetch-Site', site);
      if (forwardedHttps) attempt.set('X-Forwarded-Proto', 'https');
      if (cookieValue) attempt.set('Cookie', cookieValue);
      return attempt.type('form').send({ _csrf: tokenValue, email: user.email, password }).on('response', remember);
    };
    expect((await send({ site: 'cross-site' })).status).toBe(403);
    expect((await send({ site: 'same-site' })).status).toBe(403);
    expect((await send({ forwardedHttps: false })).status).toBe(403);
    expect((await send({ cookieValue: null })).status).toBe(403);
    expect((await send({ tokenValue: '0'.repeat(64) })).status).toBe(403);
    const untrusted = makeApp(parseEnv({ ...process.env, APP_ORIGIN: 'https://demo.app.github.dev', TRUST_PROXY: '0' }));
    expect((await send({ instance: untrusted })).status).toBe(403);
    const accepted = await send();
    expect(accepted.status).toBe(303);
    expect(accepted.headers.location).toBe('/dashboard');
    expect(accepted.headers['set-cookie'][0]).toContain('; Secure');
  });
  it('limits repeated login attempts', async () => {
    const agent = trackedAgent(app);
    const token = await csrf(agent);
    for (let index = 0; index < 10; index++) expect((await post(agent, '/auth/login', { email: 'missing@tests.example', password: 'wrong' }, token)).status).toBe(401);
    const blocked = await post(agent, '/auth/login', { email: 'missing@tests.example', password: 'wrong' }, token);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
  it('permits only ADMIN to add EMPLOYEE and never lists other companies', async () => {
    const first = await account();
    const second = await account({ name: 'Persona de otra empresa' });
    const email = `employee-${randomUUID()}@tests.example`;
    const result = await post(first.agent, '/team', { name: 'Empleado local', email, password, confirmPassword: password }, await csrf(first.agent, '/team'));
    expect(result.status).toBe(303);
    const employee = await database.user.findUniqueOrThrow({ where: { email } });
    expect(employee.companyId).toBe(first.user.companyId);
    expect(employee.role).toBe('EMPLOYEE');
    expect((await first.agent.get('/team')).text).not.toContain(second.user.email);
    const employeeAgent = trackedAgent(app);
    expect((await login(employeeAgent, email)).status).toBe(303);
    expect((await employeeAgent.get('/team')).status).toBe(403);
    expect((await post(employeeAgent, '/team', { name: 'Intento', email: 'illegal@tests.example', password, confirmPassword: password }, await csrf(employeeAgent, '/dashboard'))).status).toBe(403);
    const injected = await post(first.agent, '/team', { name: 'Intento', email: 'illegal@tests.example', password, confirmPassword: password, companyId: second.user.companyId, role: 'ADMIN' }, await csrf(first.agent, '/team'));
    expect(injected.status).toBe(400);
    expect(await database.user.findUnique({ where: { email: 'illegal@tests.example' } })).toBeNull();
  });
  it('escapes stored names and company names in EJS', async () => {
    const { agent } = await account({ name: '<script>alert(1)</script>', companyName: '<img src=x onerror=alert(1)>' });
    const response = await agent.get('/dashboard');
    expect(response.status).toBe(200);
    expect(response.text).not.toContain('<script>alert(1)</script>');
    expect(response.text).toContain('&lt;script&gt;');
    expect(response.text).toContain('&lt;img');
  });
  it('returns generic recovery responses and persists only a hashed expiring token', async () => {
    const { user } = await account();
    const agent = trackedAgent(app);
    const token = await csrf(agent, '/auth/forgot');
    const known = await post(agent, '/auth/forgot', { email: user.email }, token);
    const unknown = await post(agent, '/auth/forgot', { email: 'unknown@tests.example' }, token);
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(mailbox).toHaveLength(1);
    const raw = new URL(mailbox[0].link).searchParams.get('token');
    expect(known.text).not.toContain(raw);
    expect(unknown.text).not.toContain(raw);
    const record = await database.passwordResetToken.findUniqueOrThrow({ where: { userId: user.id } });
    expect(record.tokenHash).toBe(hashToken(raw));
    expect(record.tokenHash).not.toBe(raw);
    expect(record.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    expect(record.consumedAt).toBeNull();
  });
  it('consumes reset tokens once, updates password and revokes every previous session', async () => {
    const { user, agent: loggedIn } = await account();
    const secondSession = trackedAgent(app);
    await login(secondSession, user.email);
    const staleSession = await database.session.findFirstOrThrow({ where: { userId: user.id } });
    const recovery = trackedAgent(app);
    const token = await resetLink(recovery, user.email);
    expect((await reset(recovery, token)).status).toBe(303);
    // Simulate an in-flight request saving its pre-reset session after revocation.
    await database.session.create({ data: staleSession });
    expect((await reset(recovery, token)).status).toBe(400);
    expect((await loggedIn.get('/dashboard')).headers.location).toBe('/auth/login');
    expect((await secondSession.get('/dashboard')).headers.location).toBe('/auth/login');
    expect((await login(recovery, user.email, password)).status).toBe(401);
    expect((await login(recovery, user.email, 'Nueva-semilla-segura-2026')).status).toBe(303);
  });
  it('rejects expired and superseded reset links', async () => {
    const { user } = await account();
    const agent = trackedAgent(app);
    const expired = await resetLink(agent, user.email);
    await database.passwordResetToken.update({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    expect((await reset(agent, expired)).status).toBe(400);
    const superseded = await resetLink(agent, user.email);
    const active = await resetLink(agent, user.email);
    expect((await reset(agent, superseded)).status).toBe(400);
    expect((await reset(agent, active)).status).toBe(303);
  });
  it('allows exactly one concurrent reset consumption', async () => {
    const { user } = await account();
    const agent = trackedAgent(app);
    const token = await resetLink(agent, user.email);
    const service = createAuthService(database, config, async () => {});
    const results = await Promise.allSettled([0, 1].map(() => service.resetPassword({ token, password: 'Cambio-concurrente-seguro' })));
    expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(value => value.status === 'rejected')).toHaveLength(1);
  });
  it('enforces tenant foreign keys and stock/date constraints in MySQL itself', async () => {
    const first = await account();
    const second = await account();
    const firstInventory = await database.inventory.findUniqueOrThrow({ where: { companyId: first.user.companyId } });
    const category = await database.category.create({ data: { companyId: second.user.companyId, name: 'Ajena' } });
    await expect(database.foodItem.create({ data: {
      companyId: first.user.companyId, inventoryId: firstInventory.id, categoryId: category.id, name: 'Cruce inválido',
      quantity: '1.250', unit: 'kg', minimumStock: '0.100', receivedDate: new Date('2026-11-01'), expiresDate: new Date('2026-11-10'),
    } })).rejects.toMatchObject({ code: 'P2003' });
    const ownCategory = await database.category.create({ data: { companyId: first.user.companyId, name: 'Local' } });
    const valid = { companyId: first.user.companyId, inventoryId: firstInventory.id, categoryId: ownCategory.id, name: 'Decimal válido', quantity: '1.250', unit: 'kg', minimumStock: '0.100', receivedDate: new Date('2026-11-01'), expiresDate: new Date('2026-11-10') };
    expect((await database.foodItem.create({ data: valid })).quantity.toFixed(3)).toBe('1.250');
    await expect(database.foodItem.create({ data: { ...valid, quantity: '-1' } })).rejects.toThrow();
    await expect(database.foodItem.create({ data: { ...valid, expiresDate: new Date('2026-10-01') } })).rejects.toThrow();
    const room = await database.chatRoom.findFirstOrThrow({ where: { companyId: first.user.companyId } });
    await expect(database.chatMessage.create({ data: { companyId: first.user.companyId, roomId: room.id, userId: second.user.id, content: 'Cruce inválido' } })).rejects.toMatchObject({ code: 'P2003' });
  });
});
