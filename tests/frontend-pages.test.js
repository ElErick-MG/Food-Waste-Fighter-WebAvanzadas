import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

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
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) expect(tag).toMatch(/\ssrc="\/(assets|socket\.io)\//);
  expect(html).not.toMatch(/(src|href)="https?:\/\//i);
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
