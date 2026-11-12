import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDatabase, checkDatabase } from '../src/config/database.js';
import { parseEnv } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/passwords.js';
import { PrismaSessionStore } from '../src/config/session-store.js';
import { addDays, businessToday, dateInput } from '../src/modules/expiration/expiration.js';

const url = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV !== 'test' || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
    url.protocol !== 'mysql:' || !decodeURIComponent(url.pathname).endsWith('_test')) {
  throw new Error('Run npm run test:db with an isolated *_test database.');
}
const database = createDatabase(url.href);
const config = parseEnv(process.env);
const companyIds = [];
const sessionIds = new Set();
const password = 'Prueba-inventario-segura-2026';
const today = businessToday(config.BUSINESS_TIMEZONE);
let passwordHash;
let app;
beforeAll(async () => { passwordHash = await hashPassword(password); });
beforeEach(() => { app = createApp({ config, database, checkDatabase: () => checkDatabase(database) }); });
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
}
const agentFor = () => request.agent(app).use(test => test.on('response', remember));
async function csrf(agent, path = '/account') {
  const response = await agent.get(path);
  expect(response.status).toBe(200);
  return response.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
}
async function post(agent, path, data) {
  return agent.post(path).type('form').send({ ...data, _csrf: await csrf(agent) });
}
async function fixture() {
  const company = await database.company.create({ data: {
    name: `Negocio ${randomUUID()}`,
    inventory: { create: { name: 'Inventario principal' } },
    categories: { create: { name: 'Vegetales' } },
  }, include: { inventory: true, categories: true } });
  companyIds.push(company.id);
  const user = await database.user.create({ data: { companyId: company.id, name: 'Persona de inventario', role: 'ADMIN', email: `business-${randomUUID()}@tests.example`, passwordHash } });
  const agent = agentFor();
  const token = await csrf(agent, '/auth/login');
  expect((await agent.post('/auth/login').type('form').send({ email: user.email, password, _csrf: token })).status).toBe(303);
  const category = company.categories[0];
  const input = { name: 'Zanahoria', categoryId: category.id, quantity: '2.125', unit: 'kg', minimumStock: '1.000', receivedDate: dateInput(addDays(today, -10)), expiresDate: dateInput(addDays(today, 2)) };
  const persist = (overrides = {}) => database.foodItem.create({ data: {
    ...input, companyId: company.id, inventoryId: company.inventory.id,
    receivedDate: new Date(`${input.receivedDate}T00:00:00Z`), expiresDate: new Date(`${input.expiresDate}T00:00:00Z`), ...overrides,
  } });
  return { company, user, agent, category, input, persist };
}
const rows = response => [...response.text.matchAll(/data-item="([^"]+)"/g)].map(match => match[1]);

describe('Phase 3 business HTTP routes against isolated real MySQL', () => {
  it('protects every business entry point and never mutates by GET', async () => {
    const anonymous = agentFor();
    for (const path of ['/dashboard', '/account', '/inventory', '/inventory/new', '/inventory/unknown', '/inventory/unknown/edit', '/inventory/unknown/delete', '/categories', '/categories/unknown/delete', '/expiration', '/recipes', '/recipes/unknown']) {
      expect((await anonymous.get(path)).headers.location).toBe('/auth/login');
    }
    const f = await fixture();
    const item = await f.persist();
    expect((await f.agent.get(`/inventory/${item.id}/delete`)).status).toBe(200);
    expect(await database.foodItem.findUnique({ where: { id: item.id } })).not.toBeNull();
  });
  it('creates, reads and updates exact decimal/date values in the authenticated inventory', async () => {
    const f = await fixture();
    const result = await post(f.agent, '/inventory', f.input);
    expect(result.status).toBe(303);
    const id = result.headers.location.split('/').at(-1);
    const item = await database.foodItem.findUniqueOrThrow({ where: { id } });
    expect(item.companyId).toBe(f.company.id);
    expect(item.inventoryId).toBe(f.company.inventory.id);
    expect(String(item.quantity)).toBe('2.125');
    expect(dateInput(item.expiresDate)).toBe(f.input.expiresDate);
    const detail = await f.agent.get(result.headers.location);
    expect(detail.status).toBe(200);
    expect(detail.text).toContain('Producto registrado.');
    expect(detail.text).toContain('2.125 kg');
    const edit = await f.agent.get(`${result.headers.location}/edit`);
    expect(edit.text).toContain('value="2.125"');
    expect((await post(f.agent, `${result.headers.location}/edit`, { ...f.input, name: 'Zanahoria fresca', quantity: '0.125' })).status).toBe(303);
    expect(String((await database.foodItem.findUniqueOrThrow({ where: { id } })).quantity)).toBe('0.125');
    expect((await f.agent.get(result.headers.location)).text).toContain('Stock bajo');
  });
  it('persists success notices before a native client can follow the redirect headers', async () => {
    const f = await fixture();
    const account = await f.agent.get('/account');
    const cookie = account.headers['set-cookie'][0].split(';')[0];
    const token = account.text.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
    const set = PrismaSessionStore.prototype.set;
    const delayed = vi.spyOn(PrismaSessionStore.prototype, 'set').mockImplementation(function (id, value, callback) {
      if (value.notice) setTimeout(() => set.call(this, id, value, callback), 200);
      else set.call(this, id, value, callback);
    });
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const body = new URLSearchParams({ ...f.input, _csrf: token }).toString();
      const response = await new Promise((resolve, reject) => {
        const outgoing = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: '/inventory', method: 'POST',
          headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, incoming => {
          // Browsers can redirect immediately on headers, before the last body
          // byte. Supertest alone waits for the whole body and hides this race.
          incoming.resume();
          resolve({ status: incoming.statusCode, location: incoming.headers.location });
        });
        outgoing.on('error', reject);
        outgoing.end(body);
      });
      expect(response.status).toBe(303);
      const session = await database.session.findFirstOrThrow({ where: { userId: f.user.id } });
      expect(session.data.notice).toBe('Producto registrado.');
      expect((await f.agent.get(response.location)).text).toContain('Producto registrado.');
    } finally {
      await new Promise(resolve => server.close(resolve));
      delayed.mockRestore();
    }
  });
  it('rejects invalid/unknown fields, preserves form values and makes no partial writes', async () => {
    const f = await fixture();
    for (const override of [{ quantity: '-1' }, { quantity: '0.0001' }, { receivedDate: '2026-02-30' }, { expiresDate: f.input.receivedDate.slice(0, 4) + '-01-01' }, { companyId: 'foreign' }, { inventoryId: 'foreign' }, { categoryId: 'missing' }]) {
      const response = await post(f.agent, '/inventory', { ...f.input, ...override, name: 'Valor conservado' });
      expect(response.status).toBe(400);
      expect(response.text).toContain('role="alert"');
      expect(response.text).toContain('value="Valor conservado"');
    }
    expect(await database.foodItem.count({ where: { companyId: f.company.id } })).toBe(0);
  });
  it('requires a session-bound CSRF token for food/category create, edit and delete', async () => {
    const f = await fixture();
    const item = await f.persist();
    for (const [path, data] of [['/inventory', f.input], [`/inventory/${item.id}/edit`, f.input], [`/inventory/${item.id}/delete`, { confirm: 'yes' }], ['/categories', { name: 'Intento' }], [`/categories/${f.category.id}/edit`, { name: 'Intento' }], [`/categories/${f.category.id}/delete`, { confirm: 'yes' }]]) {
      expect((await f.agent.post(path).type('form').send(data)).status).toBe(403);
    }
    expect(await database.foodItem.count({ where: { companyId: f.company.id } })).toBe(1);
  });
  it('deletes only after explicit confirmation and handles stale targets safely', async () => {
    const f = await fixture();
    const item = await f.persist();
    const path = `/inventory/${item.id}/delete`;
    expect((await post(f.agent, path, {})).status).toBe(400);
    expect(await database.foodItem.findUnique({ where: { id: item.id } })).not.toBeNull();
    expect((await post(f.agent, path, { confirm: 'yes' })).status).toBe(303);
    expect(await database.foodItem.findUnique({ where: { id: item.id } })).toBeNull();
    expect((await post(f.agent, path, { confirm: 'yes' })).status).toBe(404);
    expect((await post(f.agent, `/inventory/${item.id}/edit`, f.input)).status).toBe(404);
  });
  it('scopes detail, update, delete, categories and filters to the authenticated company', async () => {
    const a = await fixture();
    const b = await fixture();
    const foreign = await b.persist({ name: 'Producto privado extranjero' });
    expect((await a.agent.get('/inventory')).text).not.toContain(foreign.name);
    for (const suffix of ['', '/edit', '/delete']) expect((await a.agent.get(`/inventory/${foreign.id}${suffix}`)).status).toBe(404);
    expect((await post(a.agent, `/inventory/${foreign.id}/edit`, a.input)).status).toBe(404);
    expect((await post(a.agent, `/inventory/${foreign.id}/delete`, { confirm: 'yes' })).status).toBe(404);
    expect((await post(a.agent, '/inventory', { ...a.input, categoryId: b.category.id })).status).toBe(400);
    expect((await a.agent.get(`/inventory?categoryId=${b.category.id}`)).status).toBe(400);
    expect((await a.agent.get(`/categories/${b.category.id}/delete`)).status).toBe(404);
    expect((await post(a.agent, `/categories/${b.category.id}/edit`, { name: 'Intento' })).status).toBe(404);
    expect((await post(a.agent, `/categories/${b.category.id}/delete`, { confirm: 'yes' })).status).toBe(404);
    expect((await database.foodItem.findUniqueOrThrow({ where: { id: foreign.id } })).name).toBe(foreign.name);
  });
  it('paginates 23 matching rows in SQL with stable ordering and preserved filters', async () => {
    const f = await fixture();
    await Promise.all(Array.from({ length: 23 }, (_, i) => f.persist({ name: `Lote ${i}`, expiresDate: addDays(today, 4) })));
    await f.persist({ name: 'Fuera del filtro' });
    const first = await f.agent.get('/inventory?q=Lote');
    const second = await f.agent.get('/inventory?q=Lote&page=2');
    const third = await f.agent.get('/inventory?q=Lote&page=3');
    expect(rows(first)).toHaveLength(10);
    expect(rows(second)).toHaveLength(10);
    expect(rows(third)).toHaveLength(3);
    expect(new Set([...rows(first), ...rows(second), ...rows(third)]).size).toBe(23);
    expect(rows(await f.agent.get('/inventory?q=Lote&page=2'))).toEqual(rows(second));
    expect(first.text).toContain('23 registros');
    expect(first.text).toContain('q=Lote');
    expect(first.text).toContain('page=2');
    expect(rows(await f.agent.get('/inventory?page=99999'))).toEqual([]);
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=999999', 'q=a&q=b', 'status=unknown', 'companyId=foreign']) expect((await f.agent.get(`/inventory?${query}`)).status).toBe(400);
  });
  it('searches by food/category name and combines category and expiration filters', async () => {
    const f = await fixture();
    const dairy = await database.category.create({ data: { companyId: f.company.id, name: 'Lácteos' } });
    const carrot = await f.persist({ name: 'Zanahoria fresca' });
    const milk = await f.persist({ name: 'Leche', categoryId: dairy.id, expiresDate: addDays(today, 6) });
    expect(rows(await f.agent.get('/inventory?q=zanahoria'))).toEqual([carrot.id]);
    expect(rows(await f.agent.get('/inventory?q=Vegetales'))).toEqual([carrot.id]);
    expect(rows(await f.agent.get(`/inventory?categoryId=${dairy.id}`))).toEqual([milk.id]);
    expect(rows(await f.agent.get(`/inventory?categoryId=${dairy.id}&status=soon`))).toEqual([]);
    expect(rows(await f.agent.get('/inventory?q=%27%20OR%201%3D1%20--'))).toEqual([]);
  });
  it('computes dashboard and date/status counts without counting another company', async () => {
    const f = await fixture();
    const offsets = [-1, 0, 2, 3, 5, 6];
    for (const offset of offsets) await f.persist({ name: `Día ${offset}`, expiresDate: addDays(today, offset), quantity: offset === 0 ? '1' : '2' });
    const other = await fixture();
    await other.persist({ quantity: '0', expiresDate: addDays(today, -1) });
    const dashboard = await f.agent.get('/dashboard');
    expect(dashboard.status).toBe(200);
    for (const [key, value] of Object.entries({ total: 6, soon: 4, expired: 1, low: 1 })) expect(dashboard.text).toContain(`data-metric="${key}">${value}</p>`);
    for (const [status, count] of [['expired', 1], ['critical', 2], ['warning', 2], ['normal', 1], ['soon', 4], ['low', 1]]) {
      const response = await f.agent.get(`/expiration?status=${status}`);
      expect(response.status).toBe(200);
      expect(rows(response)).toHaveLength(count);
    }
  });
  it('supports category management, tenant uniqueness and rejects deletion while in use', async () => {
    const f = await fixture();
    expect((await post(f.agent, '/categories', { name: 'Frutas' })).status).toBe(303);
    const category = await database.category.findFirstOrThrow({ where: { companyId: f.company.id, name: 'Frutas' } });
    expect((await post(f.agent, '/categories', { name: 'Frutas' })).status).toBe(409);
    expect((await post(f.agent, `/categories/${category.id}/edit`, { name: 'Frutas frescas' })).status).toBe(303);
    await f.persist();
    expect((await post(f.agent, `/categories/${f.category.id}/delete`, { confirm: 'yes' })).status).toBe(409);
    expect((await post(f.agent, `/categories/${category.id}/delete`, {})).status).toBe(400);
    expect((await post(f.agent, `/categories/${category.id}/delete`, { confirm: 'yes' })).status).toBe(303);
    expect(await database.category.findUnique({ where: { id: category.id } })).toBeNull();
    const other = await fixture();
    expect((await post(other.agent, '/categories', { name: 'Frutas' })).status).toBe(303);
  });
  it('allows EMPLOYEE to register/update foods but reserves destructive/category operations to ADMIN', async () => {
    const f = await fixture();
    await database.user.update({ where: { id: f.user.id }, data: { role: 'EMPLOYEE' } });
    const response = await post(f.agent, '/inventory', f.input);
    expect(response.status).toBe(303);
    const path = response.headers.location;
    expect((await post(f.agent, `${path}/edit`, { ...f.input, quantity: '1.125' })).status).toBe(303);
    expect((await f.agent.get(`${path}/delete`)).status).toBe(403);
    expect((await post(f.agent, `${path}/delete`, { confirm: 'yes' })).status).toBe(403);
    expect((await f.agent.get('/categories')).status).toBe(200);
    expect((await post(f.agent, '/categories', { name: 'Intento' })).status).toBe(403);
    expect((await post(f.agent, `/categories/${f.category.id}/edit`, { name: 'Intento' })).status).toBe(403);
    expect((await post(f.agent, `/categories/${f.category.id}/delete`, { confirm: 'yes' })).status).toBe(403);
  });
  it('shows persisted recipes/steps/ingredients, matches only usable stock and blocks foreign recipe IDs', async () => {
    const f = await fixture();
    const recipe = await database.recipe.create({ data: { companyId: f.company.id, name: 'Sopa de prueba', description: 'Receta ficticia', preparation: 'Lavar verduras.\nCocinar al vapor.', ingredients: { create: ['ZANAHORIA', 'Leche', 'Tomate'].map(name => ({ name, quantity: '0.500', unit: 'kg' })) } }, include: { ingredients: true } });
    await f.persist({ name: 'Zanahoria fresca' });
    await f.persist({ name: 'Leche', expiresDate: addDays(today, -1) });
    await f.persist({ name: 'Tomate', quantity: '0' });
    const list = await f.agent.get('/recipes');
    expect(list.status).toBe(200);
    expect(list.text).toContain('Sopa de prueba');
    const detail = await f.agent.get(`/recipes/${recipe.id}`);
    expect(detail.status).toBe(200);
    expect(detail.text).toContain('Cocinar al vapor.');
    for (const ingredient of recipe.ingredients) expect(detail.text).toContain(`data-ingredient="${ingredient.id}" data-available="${ingredient.name === 'ZANAHORIA'}"`);
    const other = await fixture();
    expect((await other.agent.get('/recipes')).text).not.toContain(recipe.name);
    expect((await other.agent.get(`/recipes/${recipe.id}`)).status).toBe(404);
    expect((await f.agent.get('/recipes/missing')).status).toBe(404);
    await database.recipe.createMany({ data: Array.from({ length: 11 }, (_, index) => ({ companyId: f.company.id, name: `Receta ${index}`, description: 'Ficticia', preparation: 'Lavar.' })) });
    expect((await f.agent.get('/recipes')).text.match(/Ver receta completa/g)).toHaveLength(10);
    expect((await f.agent.get('/recipes?page=2')).text.match(/Ver receta completa/g)).toHaveLength(2);
  });
  it('retains bidirectional recipe suggestions while excluding expired and empty products', async () => {
    const f = await fixture();
    await database.recipe.create({ data: { companyId: f.company.id, name: 'Receta coincidente', description: 'Ficticia', preparation: 'Lavar.', ingredients: { create: { name: 'Zanahoria fresca', quantity: '1', unit: 'kg' } } } });
    const item = await f.persist({ name: 'Zanahoria' });
    expect((await f.agent.get('/dashboard')).text).toContain('Receta coincidente');
    await database.foodItem.update({ where: { id: item.id }, data: { quantity: '0' } });
    expect((await f.agent.get('/dashboard')).text).not.toContain('Receta coincidente');
    await database.foodItem.update({ where: { id: item.id }, data: { quantity: '2', expiresDate: addDays(today, -1) } });
    expect((await f.agent.get('/dashboard')).text).not.toContain('Receta coincidente');
  });
  it('escapes stored HTML in food, category and recipe views without external scripts', async () => {
    const f = await fixture();
    const name = '<script>alert("xss")</script>';
    const item = await f.persist({ name });
    const recipe = await database.recipe.create({ data: { companyId: f.company.id, name, description: name, preparation: name } });
    await database.category.update({ where: { id: f.category.id }, data: { name } });
    for (const path of ['/dashboard', '/inventory', `/inventory/${item.id}`, `/inventory/${item.id}/edit`, `/inventory/${item.id}/delete`, '/categories', '/recipes', `/recipes/${recipe.id}`]) {
      const response = await f.agent.get(path);
      expect(response.status).toBe(200);
      expect(response.text).toContain('&lt;script&gt;');
      expect(response.text).not.toContain(name);
      expect(response.text).not.toMatch(/<script[^>]+src="https?:/);
    }
  });
});
