import 'dotenv/config';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { createDatabase, checkDatabase } from '../src/config/database.js';
import { attachRealtime } from '../src/modules/chat/chat.socket.js';
import { hashPassword } from '../src/modules/auth/passwords.js';
import { businessToday, addDays, dateInput } from '../src/modules/expiration/expiration.js';
import { isolatedDatabaseUrl } from './lib/test-database.js';

const testUrl = isolatedDatabaseUrl();
const database = createDatabase(testUrl);
const server = createServer();
const companyIds = [], userIds = [], sessionIds = new Set();
const issues = [], scans = [], errors = [], external = [], sockets = [];
const password = randomBytes(24).toString('base64url');
let browser, realtime;
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
await mkdir('work', { recursive: true });
try {
  await checkDatabase(database);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://localhost:${server.address().port}`;
  const config = parseEnv({ ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl, APP_ORIGIN: origin, TRUST_PROXY: '0' });
  const app = createApp({ config, database, checkDatabase: () => checkDatabase(database) });
  server.on('request', app);
  realtime = attachRealtime(server, { app, database, config });
  const hash = await hashPassword(password);
  const today = businessToday(config.BUSINESS_TIMEZONE);
  async function fixture() {
    const company = await database.company.create({ data: {
      name: `quality-${randomUUID()}`, inventory: { create: { name: 'Inventario ficticio' } },
      categories: { create: { name: 'Vegetales' } }, rooms: { create: { name: 'General' } },
    }, include: { inventory: true, categories: true } });
    companyIds.push(company.id);
    const users = [];
    for (const [role, name] of [['ADMIN', 'Administración ficticia'], ['EMPLOYEE', 'Empleado ficticio']]) {
      const user = await database.user.create({ data: { companyId: company.id, role, name, email: `quality-${randomUUID()}@tests.example`, passwordHash: hash } });
      users.push(user); userIds.push(user.id);
    }
    const item = await database.foodItem.create({ data: { companyId: company.id, inventoryId: company.inventory.id, categoryId: company.categories[0].id, name: 'Zanahoria ficticia', quantity: '2.125', minimumStock: '1', unit: 'kg', receivedDate: today, expiresDate: addDays(today, 2) } });
    const recipe = await database.recipe.create({ data: { companyId: company.id, name: 'Sopa ficticia', description: 'Ejemplo de preparación', preparation: 'Lavar las verduras.\nCocinar.', ingredients: { create: { name: 'Zanahoria', quantity: '1', unit: 'kg' } } } });
    return { company, users, item, recipe };
  }
  const f = await fixture(), other = await fixture();
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH || existsSync('/usr/bin/chromium') ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH || '/usr/bin/chromium' } : {}) });
  async function pageFor() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Bogota' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(origin + '/')) external.push(new URL(req.url()).origin); });
    page.on('websocket', ws => sockets.push(ws.url().split('?')[0]));
    return page;
  }
  async function login(page, user) {
    await page.goto(origin + '/auth/login');
    await page.locator('#email').fill(user.email);
    await page.locator('[name="password"]').fill(password);
    await Promise.all([page.waitForURL('**/dashboard'), page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click()]);
  }
  async function audit(page, path, width) {
    await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
    await page.goto(origin + path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.querySelector('#chat-status') || document.querySelector('#chat-status').textContent === 'Conectado al chat del equipo');
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await page.evaluate(axe);
    const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } }));
    const violations = result.violations.map(value => ({ id: value.id, impact: value.impact, targets: value.nodes.map(node => node.target) }));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    scans.push({ path: path.replace(/\/[a-z0-9]{20,30}(?=\/|$)/g, '/:id'), width, violations: violations.length, incomplete: result.incomplete.map(value => value.id), incompleteDetails: result.incomplete.map(value => ({ id: value.id, targets: value.nodes.map(node => node.target) })), overflow });
    if (violations.length || overflow) issues.push({ path: scans.at(-1).path, width, violations, overflow });
  }
  const anonymous = await pageFor(), admin = await pageFor();
  for (const width of [1280, 320]) for (const path of ['/', '/auth/login', '/auth/register', '/auth/forgot', '/auth/reset', '/missing']) await audit(anonymous, path, width);
  await login(admin, f.users[0]);
  for (const width of [1280, 320]) {
    for (const path of ['/dashboard', '/account', '/team', '/inventory', '/inventory/new', `/inventory/${f.item.id}`, `/inventory/${f.item.id}/edit`, `/inventory/${f.item.id}/delete`, '/categories', `/categories/${f.company.categories[0].id}/delete`, '/expiration', '/recipes', `/recipes/${f.recipe.id}`, '/chat']) await audit(admin, path, width);
    // Verify the actual keyboard/menu controls as well as the static axe rules.
    await admin.goto(origin + '/chat');
    await admin.keyboard.press('Tab');
    assert.equal(await admin.evaluate(() => document.activeElement.getAttribute('href')), '#main-content');
    if (width === 320) {
      await admin.locator('#mobile-menu-btn').focus();
      await admin.keyboard.press('Enter');
      assert.equal(await admin.locator('#mobile-menu-btn').getAttribute('aria-expanded'), 'true');
      await admin.keyboard.press('Enter');
      assert.equal(await admin.locator('#mobile-menu-btn').getAttribute('aria-expanded'), 'false');
    }
    await admin.screenshot({ path: `work/quality-chat-${width}.png`, fullPage: true });
  }
  const employee = await pageFor(), foreign = await pageFor();
  await login(employee, f.users[1]); await login(foreign, other.users[0]);
  for (const page of [admin, employee, foreign]) {
    await page.goto(origin + '/chat');
    await page.waitForFunction(() => document.querySelector('#chat-status').textContent === 'Conectado al chat del equipo');
  }
  await admin.waitForFunction(() => document.querySelector('#chat-count').textContent === '2');
  const message = `Coordinación ficticia ${randomUUID()}`;
  await admin.locator('#chat-content').fill(message);
  await admin.locator('#chat-send').click();
  await employee.getByText(message, { exact: true }).waitFor();
  assert.equal(await foreign.getByText(message, { exact: true }).count(), 0);
  await employee.reload();
  await employee.getByText(message, { exact: true }).waitFor();
  await admin.goto(origin + '/inventory/new');
  await admin.locator('#name').fill('Acelga de revisión');
  await admin.locator('#categoryId').selectOption(f.company.categories[0].id);
  await admin.locator('#quantity').fill('1.125'); await admin.locator('#minimumStock').fill('1');
  await admin.locator('#receivedDate').fill(dateInput(today));
  await admin.locator('#expiresDate').fill(dateInput(addDays(today, 2)));
  const before = employee.url();
  await Promise.all([admin.waitForURL(/\/inventory\/[^/]+$/), admin.getByRole('button', { name: 'Guardar Producto' }).click()]);
  await employee.locator('#inventory-live').waitFor({ state: 'visible' });
  assert.equal(employee.url(), before);
  assert.match(await employee.locator('#inventory-live-text').textContent(), /Acelga de revisión.*próximo a caducar/);
  assert.equal(await foreign.locator('#inventory-live').isVisible(), false);
  const brandColor = await employee.locator('nav a[href="/dashboard"]').first().evaluate(node => getComputedStyle(node).color);
  assert.equal(brandColor, 'rgb(22, 163, 74)');
  const report = {
    measuredAt: new Date().toISOString(), sourceRevision: process.env.VERIFICATION_REVISION || 'working-tree', browser: browser.version(), brandColor,
    scans, issues, functional: { nativeLogin: true, keyboardSkipLink: true, keyboardMobileMenu: true, twoDistinctUsers: true, liveExchange: true, persistedHistory: true, companyIsolation: true, notificationWithoutReload: true, websocketObserved: sockets.length > 0 },
    errors, externalOrigins: [...new Set(external)], limitations: ['Automated axe WCAG A/AA and best-practice checks plus targeted manual/keyboard behavior are not complete WCAG certification.', 'Local HTTP and isolated MySQL; actual Codespaces traffic is not captured by this command. Incomplete axe checks require human review.'],
  };
  await writeFile('work/browser-quality.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: issues.length || errors.length || external.length ? 'FAIL' : 'PASS', scans: scans.length, issuePages: issues.length, ruleIds: [...new Set(issues.flatMap(issue => issue.violations.map(value => value.id)))], errors, externalOrigins: [...new Set(external)], report: 'work/browser-quality.json' }));
  if (issues.length) throw new Error('Accessibility/overflow issues; inspect work/browser-quality.json');
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(sockets.length);
} finally {
  if (browser) {
    for (const context of browser.contexts()) for (const cookie of await context.cookies()) if (cookie.name === 'fwf.sid') sessionIds.add(decodeURIComponent(cookie.value).slice(2).split('.')[0]);
    await browser.close();
  }
  if (realtime) await new Promise(resolve => realtime.close(resolve));
  else if (server.listening) await new Promise(resolve => server.close(resolve));
  await database.session.deleteMany({ where: { OR: [{ id: { in: [...sessionIds] } }, { userId: { in: userIds } }] } });
  await database.foodItem.deleteMany({ where: { companyId: { in: companyIds } } });
  await database.company.deleteMany({ where: { id: { in: companyIds } } });
  await database.$disconnect();
}
