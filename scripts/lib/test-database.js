// Never print a supplied URL: malformed values may contain credentials.
export function isolatedDatabaseUrl(env = process.env) {
  try {
    const test = new URL(env.TEST_DATABASE_URL);
    const development = new URL(env.DATABASE_URL);
    const name = decodeURIComponent(test.pathname.slice(1));
    if (test.protocol !== 'mysql:' || !name.endsWith('_test') ||
        decodeURIComponent(development.pathname.slice(1)) === name) throw new Error();
    return test.href;
  } catch {
    throw new Error('Refusing verification: configure a separate MySQL TEST_DATABASE_URL ending in _test, different from development.');
  }
}
