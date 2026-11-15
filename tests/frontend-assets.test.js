import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

// Front-end redesign, stage 0: every asset of the new design is served from the
// application origin, so the same-origin Content Security Policy stays unchanged.
const config = parseEnv({
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'mysql://unit:synthetic@127.0.0.1:3306/unit_test',
  SESSION_SECRET: 'a'.repeat(32),
});
const app = () => createApp({ config, checkDatabase: vi.fn().mockResolvedValue(undefined) });

describe('New front-end assets (stage 0)', () => {
  it.each([
    ['/assets/vendor/three/three.min.js', /javascript/],
    ['/assets/vendor/motion/motion.js', /javascript/],
    ['/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-400-normal.woff2', /font\/woff2/],
    ['/assets/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-700-normal.woff2', /font\/woff2/],
    ['/assets/fwf/css/fwf-base.css', /text\/css/],
    ['/assets/fwf/refri/puertas.jpg', /image\/jpeg/],
    ['/assets/fwf/refri/interior-der.jpg', /image\/jpeg/],
    ['/assets/fwf/img/cocina.png', /image\/png/],
    ['/assets/fwf/img/productos/leche.jpg', /image\/jpeg/],
  ])('serves %s from the same origin', async (path, type) => {
    const response = await request(app()).get(path);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(type);
  });

  it('does not list vendor directories', async () => {
    expect((await request(app()).get('/assets/vendor/three/')).status).toBe(404);
    expect((await request(app()).get('/assets/fonts/plus-jakarta-sans/')).status).toBe(404);
  });

  it('keeps the existing Inter font route working', async () => {
    const response = await request(app()).get('/assets/fonts/inter-latin-400-normal.woff2');
    expect(response.status).toBe(200);
  });

  it('keeps the same-origin CSP for scripts, styles and images', async () => {
    const csp = (await request(app()).get('/')).headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("img-src 'self'");
  });

  it('design stylesheet only uses same-origin fonts and no remote imports', async () => {
    const css = (await request(app()).get('/assets/fwf/css/fwf-base.css')).text;
    expect(css).toContain('/assets/fonts/plus-jakarta-sans/');
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toContain('@import');
  });
});
