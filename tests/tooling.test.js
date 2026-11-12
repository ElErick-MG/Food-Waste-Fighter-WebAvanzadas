import { describe, it, expect } from 'vitest';
import { isolatedDatabaseUrl } from '../scripts/lib/test-database.js';

describe('verification database safety boundary', () => {
  const env = { DATABASE_URL: 'mysql://dev:private-dev@localhost/app', TEST_DATABASE_URL: 'mysql://test:private-test@localhost/app_test' };
  it('accepts only an explicitly configured independent MySQL test database', () => {
    expect(isolatedDatabaseUrl(env)).toBe(env.TEST_DATABASE_URL);
  });
  it.each([undefined, 'mysql://test:private-test@localhost/app', 'mysql://test:private-test@localhost/another', 'postgres://test:private-test@localhost/app_test', 'malformed-private-secret'])('rejects unsafe test configuration without disclosing its value (%s)', value => {
    let error;
    try { isolatedDatabaseUrl({ ...env, TEST_DATABASE_URL: value }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain('private');
    expect(error.message).not.toContain('malformed');
  });
  it('rejects the development database even if its name ends in _test', () => {
    expect(() => isolatedDatabaseUrl({ ...env, DATABASE_URL: env.TEST_DATABASE_URL })).toThrow('Refusing verification');
  });
});
