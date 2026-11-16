import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { expiration, displayDate } from '../src/modules/expiration/expiration.js';

// Front-end redesign, stage 1: landing and access pages in the new design.
// They keep the same-origin CSP (no inline scripts or styles) and the hooks that
// other tests and the browser verification rely on.
const config = parseEnv({
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'mysql://unit:synthetic@127.0.0.1:3306/unit_test',
  SESSION_SECRET: 'a'.repeat(32),
});
const app = () => createApp({ config, checkDatabase: vi.fn().mockResolvedValue(undefined) });
const view = name => fileURLToPath(new URL(`../src/views/${name}.ejs`, import.meta.url));
const csrfToken = 'f'.repeat(64);
const render = (name, locals = {}) => ejs.renderFile(view(name), { error: null, message: null, values: {}, csrfToken, ...locals });

function expectCspSafe(html) {
  expect(html).not.toMatch(/\sstyle\s*=/i);
  expect(html).not.toMatch(/<style[\s>]/i);
  expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  // Executable scripts come from files; a JSON data island (never executed) is allowed.
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) expect(tag).toMatch(/\ssrc="\/(assets|socket\.io)\/|\stype="application\/json"/);
  // Scripts and stylesheets stay same-origin; only product images (img-src https:) may be remote.
  expect(html).not.toMatch(/<(script|link)\b[^>]*(src|href)="https?:\/\//i);
  expect(html).not.toContain('data:');
}

describe('New landing page (stage 1)', () => {
  it('renders the 3D hero with access links and no inline code', async () => {
    const response = await request(app()).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<body class="fwf">');
    expect(response.text).toContain('id="refri3d"');
    expect(response.text).toContain('href="/auth/login"');
    expect(response.text).toContain('href="/auth/register"');
    expect(response.text).toContain('/assets/vendor/three/three.min.js');
    expect(response.text).toContain('/assets/fwf/js/portada.js');
    expect(response.text).toMatch(/<h1[^>]*>[^<]*desperdicio de comida/);
    expectCspSafe(response.text);
  });

  it.each([
    ['/assets/fwf/js/refri3d.js', /javascript/],
    ['/assets/fwf/js/fwf-motion.js', /javascript/],
    ['/assets/fwf/js/portada.js', /javascript/],
    ['/assets/fwf/js/acceso.js', /javascript/],
    ['/assets/fwf/css/portada.css', /text\/css/],
    ['/assets/fwf/img/grano.svg', /image\/svg\+xml/],
  ])('serves %s', async (path, type) => {
    const response = await request(app()).get(path);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(type);
  });

  it('loads the 3D model textures from files instead of inline data', async () => {
    const js = (await request(app()).get('/assets/fwf/js/refri3d.js')).text;
    expect(js).not.toContain('data:image');
    expect(js).toContain('/assets/fwf/refri/');
    expect(js).not.toMatch(/https?:\/\//);
  });
});

describe('New access pages (stage 1)', () => {
  it('login keeps the real POST form, CSRF token and browser-verification hooks', async () => {
    const html = await render('auth/login', { values: { email: 'persona@tests.example' } });
    expect(html).toContain('action="/auth/login" method="post"');
    expect(html).toContain(`name="_csrf" value="${csrfToken}"`);
    expect(html).toContain('id="email"');
    expect(html).toContain('value="persona@tests.example"');
    expect(html).toContain('name="password"');
    expect(html).toMatch(/<button type="submit"[^>]*>Iniciar Sesión<\/button>/);
    expect(html).toContain('href="/auth/forgot"');
    expect(html).toContain('href="/auth/register"');
    expectCspSafe(html);
  });

  it('register keeps every field the validation schema expects', async () => {
    const html = await render('auth/register', { values: { name: 'Ana', email: 'ana@tests.example', companyName: 'Café' } });
    for (const name of ['_csrf', 'companyName', 'name', 'email', 'password', 'confirmPassword']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('data-password-form');
    expect(html).toContain('id="errorContrasena"');
    expect(html).toContain('value="Café"');
    expectCspSafe(html);
  });

  it('forgot and reset keep their forms and token field', async () => {
    const forgot = await render('auth/forgot', { message: 'Si existe una cuenta con ese correo, se enviará un enlace para recuperar la contraseña.' });
    expect(forgot).toContain('action="/auth/forgot"');
    expect(forgot).toMatch(/role="status"[^>]*>[\s\S]*Si existe una cuenta/);
    expectCspSafe(forgot);
    const reset = await render('auth/reset', { values: { token: 'a'.repeat(64) } });
    expect(reset).toContain('action="/auth/reset"');
    expect(reset).toContain(`name="token" value="${'a'.repeat(64)}"`);
    expectCspSafe(reset);
  });

  it('shows errors as alerts and escapes user input', async () => {
    const html = await render('auth/login', { error: 'El correo o la contraseña no son correctos.', values: { email: '"><script>x</script>' } });
    expect(html).toMatch(/role="alert"[\s\S]*El correo o la contraseña no son correctos\./);
    expect(html).not.toContain('<script>x</script>');
  });

  it('keeps the decorative hero hidden from assistive technology behind the card', async () => {
    const html = await render('auth/login');
    expect(html).toMatch(/<div id="escena" data-modo="fondo" aria-hidden="true" inert>/);
    expect(html).not.toContain('id="pista"');
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});

describe('New summary page /dashboard (stage 3)', () => {
  const today = new Date('2026-11-15T00:00:00Z');
  const day = n => new Date(today.getTime() + n * 86400000);
  const decimal = low => ({ lte: () => low });
  const base = (overrides = {}) => ({
    csrfToken, currentPath: '/dashboard', message: null, today, businessTimezone: 'America/Guayaquil',
    displayDate, expiration: date => expiration(date, today),
    currentUser: { name: 'Ana Pérez', email: 'ana@tests.example', role: 'ADMIN', company: { name: 'Café Semilla' } },
    metrics: { total: 6, soon: 4, expired: 1, low: 1 },
    alerts: [
      { id: 'item-1', name: 'Leche', expiresDate: day(-1), quantity: decimal(true), minimumStock: 1, imageUrl: 'https://images.example.com/leche.jpg', category: { name: 'Lácteos', color: '#4A7FD6' } },
      { id: 'item-2', name: 'Tomate', expiresDate: day(2), quantity: decimal(false), minimumStock: 1, imageUrl: null, category: { name: 'Verduras', color: null } },
    ],
    suggested: [{ id: 'recipe-1', name: 'Salsa de tomate', description: 'Para tomates maduros.', matches: ['Tomate'] }],
    ...overrides,
  });

  it('renders real metrics, alerts and recipes with links to the existing pages', async () => {
    const html = await render('dashboard', base());
    for (const [key, value] of Object.entries({ total: 6, soon: 4, expired: 1, low: 1 })) expect(html).toContain(`data-metric="${key}">${value}</p>`);
    for (const href of ['/inventory', '/expiration?status=soon', '/expiration?status=expired', '/inventory?status=low', '/expiration', '/inventory/item-1', '/recipes/recipe-1']) expect(html).toContain(`href="${href}"`);
    expect(html).toContain('¡Hola, Ana Pérez!');
    expect(html).toContain('Caducado · 14/11/2026');
    expect(html).toContain('Crítico: 2 días');
    expect(html).toContain('Stock bajo');
    expect(html).toContain('src="https://images.example.com/leche.jpg"');
    expect(html).toContain('Coincide por nombre: Tomate');
    expect(html).toContain('Fechas del negocio: 15/11/2026 (America/Guayaquil)');
    expect(html).toContain('id="inventory-live"');
    expect(html).toContain('<meta name="csrf-token"');
    expectCspSafe(html);
  });

  it('keeps every section reachable from the account menu and logout as a CSRF POST', async () => {
    const admin = await render('dashboard', base());
    for (const href of ['/inventory', '/expiration', '/recipes', '/categories', '/chat', '/account', '/team']) expect(admin).toContain(`<a href="${href}"`);
    expect(admin).toMatch(/<form method="post" action="\/auth\/logout"><input type="hidden" name="_csrf" value="f{64}">/);
    const employee = await render('dashboard', base({ currentUser: { ...base().currentUser, role: 'EMPLOYEE' } }));
    expect(employee).not.toContain('href="/team"');
  });

  it('shows empty states and only plays the arrival animation when asked', async () => {
    const html = await render('dashboard', base({ alerts: [], suggested: [], metrics: { total: 0, soon: 0, expired: 0, low: 0 } }));
    expect(html).toContain('¡Tu inventario está vacío!');
    expect(html).toContain('href="/inventory/new"');
    expect(html).toContain('No hay recetas que coincidan');
    expect(html).not.toContain('data-transicion');
    expect(await render('dashboard', base({ transicion: true }))).toContain('<body class="fwf" data-transicion>');
  });

  it('escapes user and company names', async () => {
    const html = await render('dashboard', base({ currentUser: { ...base().currentUser, name: '<script>alert(1)</script>', company: { name: '<img src=x onerror=alert(1)>' } } }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
  });
});

describe('Open fridge /inventory and product cards (stage 4)', () => {
  const today = new Date('2026-11-15T00:00:00Z');
  const day = n => new Date(today.getTime() + n * 86400000);
  const decimal = (value, low = false) => ({ lte: () => low, toString: () => value });
  const currentUser = { name: 'Ana Pérez', email: 'ana@tests.example', role: 'ADMIN', company: { name: 'Café Semilla' } };
  const item = (overrides = {}) => ({ id: 'item-1', name: 'Leche', expiresDate: day(-1), receivedDate: day(-6), quantity: decimal('2.125', true), minimumStock: decimal('1.000'), unit: 'kg', imageUrl: null, category: { name: 'Lácteos', color: '#4A7FD6' }, ...overrides });
  const base = (overrides = {}) => ({
    csrfToken, currentPath: '/inventory', message: null, today, businessTimezone: 'America/Guayaquil',
    displayDate, expiration: date => expiration(date, today), currentUser,
    items: [item()], categories: [{ id: 'cat-1', name: 'Lácteos' }],
    filters: { q: '', categoryId: '', status: '', page: 1 },
    pagination: { total: 23, page: 1, pages: 3, previous: null, next: '/inventory?q=Lote&categoryId=&status=&page=2' },
    expirationPage: false, listaAbierta: false, refri: '{"productos":[]}',
    ...overrides,
  });

  it('renders the fridge shell, the server list (data-item, pagination) and a JSON island', async () => {
    const html = await render('inventory/refri', base());
    expect(html).toContain('id="hueco"');
    expect(html).toContain('<script type="application/json" id="datos-refri">{"productos":[]}</script>');
    expect(html).toContain('data-item="item-1"');
    expect(html).toContain('23 registros');
    expect(html).toContain('page=2');
    for (const href of ['/inventory/new', '/categories', '/inventory/item-1', '/inventory/item-1/edit', '/inventory/item-1/delete', '/dashboard']) expect(html).toContain(`href="${href}"`);
    expect(html).toContain('Stock bajo');
    expect(html).toContain('/assets/fwf/css/refri-sin-js.css');
    expect(html).not.toContain('<body class="fwf" data-lista>');
    expectCspSafe(html);
  });

  it('opens the list after a search and hides admin-only links from employees', async () => {
    expect(await render('inventory/refri', base({ listaAbierta: true }))).toContain('<body class="fwf" data-lista>');
    const employee = await render('inventory/refri', base({ currentUser: { ...currentUser, role: 'EMPLOYEE' } }));
    expect(employee).not.toContain('/delete"');
    expect(employee).not.toContain('Agregar categoría');
  });

  it('keeps the product form fields, CSRF and the verification hooks', async () => {
    const html = await render('inventory/form', { currentUser, csrfToken, editing: false, id: undefined, values: { name: 'Valor conservado', unit: 'kg' }, error: 'Escribe una fecha válida.', categories: [{ id: 'cat-1', name: 'Lácteos' }] });
    for (const id of ['name', 'categoryId', 'quantity', 'minimumStock', 'unit', 'receivedDate', 'expiresDate', 'imageUrl']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('method="post" action="/inventory"');
    expect(html).toContain(`name="_csrf" value="${csrfToken}"`);
    expect(html).toMatch(/<button type="submit"[^>]*>Guardar Producto<\/button>/);
    expect(html).toContain('value="Valor conservado"');
    expect(html).toMatch(/role="alert"[^>]*>Escribe una fecha válida\./);
    expect(html).toContain('/assets/inventory.js');
    expect(html).not.toContain('three.min.js');
    expectCspSafe(html);
  });

  it('detail and delete keep their data, admin actions and confirmation form', async () => {
    const locals = { currentUser, csrfToken, message: 'Producto registrado.', today, displayDate, expiration: date => expiration(date, today) };
    const detail = await render('inventory/detail', { ...locals, item: item({ imageUrl: 'https://images.example.com/leche.jpg' }) });
    expect(detail).toContain('Producto registrado.');
    expect(detail).toContain('2.125 kg');
    expect(detail).toContain('Stock bajo');
    expect(detail).toContain('src="https://images.example.com/leche.jpg"');
    expect(detail).toContain('href="/inventory/item-1/delete"');
    expectCspSafe(detail);
    const remove = await render('inventory/delete', { ...locals, item: item(), error: null });
    expect(remove).toContain('action="/inventory/item-1/delete"');
    expect(remove).toContain('name="confirm" value="yes" required');
    expectCspSafe(remove);
  });
});

describe('Categories, team and account (stage 5)', async () => {
  const { CATEGORY_PALETTE } = await import('../src/modules/categories/category-colors.js');
  const admin = { name: 'Ana Pérez', email: 'ana@tests.example', role: 'ADMIN', company: { name: 'Café Semilla' } };
  const employee = { ...admin, role: 'EMPLOYEE' };
  const categories = [
    { id: 'cat-1', name: 'Lácteos', color: '#4A7FD6', _count: { items: 1 } },
    { id: 'cat-2', name: 'Bebidas', color: '#123456', _count: { items: 0 } },
  ];
  const listLocals = (overrides = {}) => ({ currentUser: admin, csrfToken, message: null, error: null, values: {}, categories, nextColor: '#2F9E5B', palette: CATEGORY_PALETTE, ...overrides });

  it('lets admins edit, colour, delete and create categories through real POST forms', async () => {
    const html = await render('categories/list', listLocals());
    expect(html).toContain('method="post" action="/categories/cat-1/edit"');
    expect(html).toContain('method="post" action="/categories"');
    expect(html).toContain('href="/categories/cat-1/delete"');
    expect(html).toContain('1 producto<');
    expect(html).toContain('0 productos');
    expect(html).toMatch(/id="color-cat-1-4A7FD6" name="color" value="#4A7FD6" checked/);
    expect(html).toMatch(/id="color-nueva-2F9E5B" name="color" value="#2F9E5B" checked/);
    expect(html).toContain('value="#123456" checked');   // a custom colour stays selectable
    expect(html).toContain('<span class="sr-only">Azul</span>');
    expectCspSafe(html);
  });

  it('shows categories read-only to employees and keeps typed values after an error', async () => {
    const readOnly = await render('categories/list', listLocals({ currentUser: employee }));
    expect(readOnly).not.toContain('method="post"');
    expect(readOnly).not.toContain('/delete"');
    const retry = await render('categories/list', listLocals({ error: 'Ya existe una categoría con ese nombre.', values: { id: 'cat-1', name: 'Repetida', color: '#d2513f' } }));
    expect(retry).toMatch(/role="alert"[^>]*>Ya existe una categoría con ese nombre\./);
    expect(retry).toContain('<details class="cat-editar" open>');
    expect(retry).toContain('value="Repetida"');
    expect(retry).toMatch(/value="#D2513F" checked/);
  });

  it('keeps the employee form fields, the people list and CSRF on /team', async () => {
    const html = await render('users/team', { currentUser: admin, csrfToken, error: null, users: [{ id: 'u1', name: 'Ana Pérez', email: 'ana@tests.example', role: 'ADMIN' }, { id: 'u2', name: 'Luis', email: 'luis@tests.example', role: 'EMPLOYEE' }] });
    for (const name of ['_csrf', 'name', 'email', 'password', 'confirmPassword']) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('method="post" action="/team" data-password-form');
    expect(html).toContain('luis@tests.example');
    expect(html).toContain('Empleado');
    expect(html).toContain('/assets/auth.js');
    expectCspSafe(html);
  });

  it('account shows the user data, the team link for admins and a CSRF logout', async () => {
    const html = await render('account', { currentUser: admin, csrfToken });
    expect(html).toContain('Hola, Ana Pérez');
    expect(html).toContain('href="/team"');
    expect(html).toContain(`<form method="post" action="/auth/logout" class="ficha-salir"><input type="hidden" name="_csrf" value="${csrfToken}">`);
    expectCspSafe(html);
    expect(await render('account', { currentUser: employee, csrfToken })).not.toContain('href="/team"');
    const remove = await render('categories/delete', { currentUser: admin, csrfToken, error: null, category: categories[0] });
    expect(remove).toContain('action="/categories/cat-1/delete"');
    expect(remove).toContain('name="confirm" value="yes" required');
  });
});

describe('Team chat: bubble and /chat page (stage 6)', () => {
  const currentUser = { name: 'Ana Pérez', email: 'ana@tests.example', role: 'ADMIN', company: { name: 'Café Semilla' } };
  const ids = ['chat-status', 'chat-form', 'chat-content', 'chat-send', 'chat-messages', 'chat-older', 'chat-error', 'chat-empty', 'chat-count', 'chat-users'];
  const message = { id: 'm1', createdAt: '2026-11-15T15:00:00.000Z', content: '<b>Usar</b> la leche hoy', sender: { id: 'u2', name: 'Luis' } };

  it('/chat keeps every element realtime.js drives, the server room and the history', async () => {
    const html = await render('chat/index', { currentUser, csrfToken, currentPath: '/chat', businessTimezone: 'America/Guayaquil', room: { id: 'room-1', name: 'General' }, history: { messages: [message], hasMore: true } });
    for (const id of ids) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('data-chat-room="room-1"');
    expect(html).toContain('data-message-id="m1"');
    expect(html).toContain('data-sender-id="u2"');
    expect(html).toContain('&lt;b&gt;Usar&lt;/b&gt; la leche hoy');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('/assets/realtime.js');
    expect(html).toContain('/assets/fwf/js/chat.js');
    expect(html).not.toContain('id="chatBurbuja"');
    expectCspSafe(html);
  });

  it('the summary and the fridge carry the floating bubble with an empty room (from chat:ready)', async () => {
    const today = new Date('2026-11-15T00:00:00Z');
    const dashboard = await render('dashboard', {
      csrfToken, currentPath: '/dashboard', message: null, today, businessTimezone: 'America/Guayaquil', displayDate, expiration: date => expiration(date, today),
      currentUser, metrics: { total: 0, soon: 0, expired: 0, low: 0 }, alerts: [], suggested: [],
    });
    expect(dashboard).toContain('id="chatBurbuja"');
    expect(dashboard).toContain('data-chat-room=""');
    expect(dashboard.match(/data-chat-room=/g)).toHaveLength(1);   // realtime.js uses the first one
    for (const id of ids) expect(dashboard).toContain(`id="${id}"`);
    expectCspSafe(dashboard);
  });
});
