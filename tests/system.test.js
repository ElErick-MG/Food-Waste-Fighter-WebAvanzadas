import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

const input = {
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'mysql://unit:synthetic@127.0.0.1:3306/unit_test',
  SESSION_SECRET: 'a'.repeat(32),
};
const config = parseEnv(input);
const app = (checkDatabase = vi.fn().mockResolvedValue(undefined), settings = config) =>
  createApp({ config: settings, checkDatabase });

describe('Phase 1 HTTP foundation (not business-feature acceptance)', () => {
  it('renders the original Spanish landing markup with working authentication links', async () => {
    const response = await request(app()).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('lang="es"');
    expect(response.text).toContain('desperdicio de comida');
    expect(response.text).toContain('/auth/register');
    expect(response.text).not.toContain('2.3M');
    expect(response.text).toContain('/assets/styles.css');
  });
  it('liveness does not pretend to check MySQL', async () => {
    const check = vi.fn().mockRejectedValue(new Error('offline'));
    const response = await request(app(check)).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(check).not.toHaveBeenCalled();
  });
  it('readiness calls its database dependency and prevents response caching', async () => {
    const check = vi.fn().mockResolvedValue(undefined);
    const response = await request(app(check)).get('/ready');
    expect(check).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', database: 'up' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('returns 503 on database failure without leaking connection details', async () => {
    const response = await request(app(vi.fn().mockRejectedValue(new Error('private-db-password')))).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable', database: 'down' });
    expect(response.text).not.toContain('private-db-password');
  });
  it('returns a safe 404 rather than reflecting arbitrary input', async () => {
    const response = await request(app()).get('/unknown?secret=private-value');
    expect(response.status).toBe(404);
    expect(response.text).not.toContain('private-value');
  });
  it('sets restrictive same-origin security headers without Express disclosure', async () => {
    const response = await request(app()).get('/');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
  it('uses HTTPS upgrade and HSTS when configured for a forwarded HTTPS origin', async () => {
    const settings = parseEnv({ ...input, APP_ORIGIN: 'https://example.app.github.dev', TRUST_PROXY: '1' });
    const instance = app(undefined, settings);
    expect(instance.get('trust proxy')).toBe(1);
    const response = await request(instance).get('/');
    expect(response.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
  });
});

describe('configuration fails closed without disclosing secrets', () => {
  it('accepts the expected MySQL and Node HTTP setup', () => {
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.trustProxy).toBe(false);
  });
  it.each([
    { PORT: '70000' },
    { APP_ORIGIN: 'ftp://example.com' },
    { APP_ORIGIN: 'https://user:password@example.com' },
    { APP_ORIGIN: 'https://example.com/path' },
    { NODE_ENV: 'production', APP_ORIGIN: 'http://example.com' },
    { DATABASE_URL: 'postgresql://unit:secret@localhost/unit' },
    { SESSION_SECRET: 'short-private-value' },
    { TRUST_PROXY: 'true' },
    { BUSINESS_TIMEZONE: 'Invalid/Timezone' },
  ])('rejects invalid settings %j', (override) => {
    expect(() => parseEnv({ ...input, ...override })).toThrow('Invalid environment variables:');
  });
  it('reports invalid keys without including their secret values', () => {
    try {
      parseEnv({ ...input, SESSION_SECRET: 'do-not-log-me' });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error.message).toContain('SESSION_SECRET');
      expect(error.message).not.toContain('do-not-log-me');
    }
  });
});
