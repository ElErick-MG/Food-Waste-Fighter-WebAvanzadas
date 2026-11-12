import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { createDatabase, checkDatabase } from '../src/config/database.js';
import { parseEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';

// Defense in depth: direct vitest invocation must also fail closed.
const url = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV !== 'test' ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
    !decodeURIComponent(url.pathname).endsWith('_test')) {
  throw new Error('Run npm run test:db with an isolated *_test database.');
}
const database = createDatabase(url.href);
const createdIds = [];

function startProcess(script, overrides = {}) {
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, ...overrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal, output }));
  });
  return { child, exited };
}

async function unusedPort() {
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitUntilReady(port, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ready`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return response;
    } catch { /* Wait for the real production entry point to start listening. */ }
    await setTimeout(50);
  }
  throw new Error('Production entry point did not become ready.');
}
afterAll(async () => {
  try {
    if (createdIds.length) {
      await database.foodItem.deleteMany({ where: { companyId: { in: createdIds } } });
      await database.company.deleteMany({ where: { id: { in: createdIds } } });
    }
  } finally {
    await database.$disconnect();
  }
});

describe('real MySQL/Prisma Phase 1 bootstrap', () => {
  it('checks MySQL through the HTTP readiness endpoint', async () => {
    const config = parseEnv(process.env);
    const app = createApp({ config, checkDatabase: () => checkDatabase(database) });
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('up');
  });
  it('persists and reads a fictional company, including unicode', async () => {
    const id = `test-${randomUUID().slice(0, 20)}`;
    createdIds.push(id);
    await database.company.create({ data: { id, name: 'Cafetería de prueba 🌱' } });
    const stored = await database.company.findUnique({ where: { id } });
    expect(stored.name).toBe('Cafetería de prueba 🌱');
    expect(stored.createdAt).toBeInstanceOf(Date);
  });
  it('enforces primary-key uniqueness in MySQL', async () => {
    const id = `test-${randomUUID().slice(0, 20)}`;
    createdIds.push(id);
    await database.company.create({ data: { id, name: 'Primera' } });
    await expect(database.company.create({ data: { id, name: 'Duplicada' } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('runs the real seed twice without duplicating or overwriting its company', async () => {
    const where = { id: 'demo-cafeteria' };
    const existing = await database.company.findUnique({ where });
    if (!existing) createdIds.push(where.id);
    expect((await startProcess('prisma/seed.js').exited).code).toBe(0);
    const first = await database.company.findUniqueOrThrow({ where });
    const counts = async () => Promise.all([
      database.user.count({ where: { companyId: where.id } }),
      database.inventory.count({ where: { companyId: where.id } }),
      database.category.count({ where: { companyId: where.id } }),
      database.foodItem.count({ where: { companyId: where.id } }),
      database.recipe.count({ where: { companyId: where.id } }),
      database.recipeIngredient.count({ where: { companyId: where.id } }),
      database.chatRoom.count({ where: { companyId: where.id } }),
      database.chatMessage.count({ where: { companyId: where.id } }),
    ]);
    const seededCounts = await counts();
    expect(seededCounts).toEqual([2, 1, 1, 1, 1, 1, 1, 1]);
    const adminBefore = await database.user.findUniqueOrThrow({ where: { id: 'demo-admin' } });
    expect((await startProcess('prisma/seed.js').exited).code).toBe(0);
    expect(await database.company.count({ where })).toBe(1);
    expect(await counts()).toEqual(seededCounts);
    expect(await database.user.findUniqueOrThrow({ where: { id: 'demo-admin' } })).toEqual(adminBefore);
    expect(await database.company.findUniqueOrThrow({ where })).toEqual(first);
    if (existing) expect(first).toEqual(existing);
  }, 10000);

  it('starts the production entry point with MySQL and shuts down cleanly on SIGTERM', async () => {
    const port = await unusedPort();
    const { child, exited } = startProcess('src/server.js', { HOST: '127.0.0.1', PORT: String(port) });
    try {
      expect(await (await waitUntilReady(port, child)).json()).toEqual({ status: 'ready', database: 'up' });
      const home = await fetch(`http://127.0.0.1:${port}/`);
      expect(home.status).toBe(200);
      expect(await home.text()).toContain('Food Waste Fighter');
      expect((await fetch(`http://127.0.0.1:${port}/assets/styles.css`)).status).toBe(200);
      child.kill('SIGTERM');
      const result = await Promise.race([
        exited,
        setTimeout(5000, undefined, { ref: false }).then(() => { throw new Error('Shutdown did not release the HTTP server and database pool.'); }),
      ]);
      expect(result).toMatchObject({ code: 0, signal: null });
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
    }
  }, 15000);

  it('fails startup safely when MySQL is unreachable, without opening the HTTP port', async () => {
    const port = await unusedPort();
    const unavailable = new URL(url);
    unavailable.port = String(await unusedPort());
    const { child, exited } = startProcess('src/server.js', {
      HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: unavailable.href,
    });
    try {
      const result = await Promise.race([
        exited,
        // The adapter probes server capabilities before SELECT 1: two 5s acquisition timeouts.
        setTimeout(15000, undefined, { ref: false }).then(() => { throw new Error('Startup did not fail within the connection timeouts.'); }),
      ]);
      expect(result).toMatchObject({ code: 1, signal: null });
      expect(result.output).toContain('Startup failed.');
      expect(result.output).not.toContain(decodeURIComponent(url.password));
      expect(result.output).not.toContain('listening on');
      await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
    }
  }, 20000);
});
