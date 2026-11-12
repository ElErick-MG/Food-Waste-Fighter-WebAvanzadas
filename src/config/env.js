import { z } from 'zod';

const databaseUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'mysql:' && !!url.username && !!url.password && url.pathname.length > 1;
}, 'A MySQL URL with user, password and database is required');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.string().url().refine(value => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  }, 'An HTTP(S) origin is required'),
  BUSINESS_TIMEZONE: z.string().default('America/Guayaquil').refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Invalid IANA timezone'),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  DATABASE_URL: databaseUrl,
  SESSION_SECRET: z.string().min(32),
});

export function parseEnv(input) {
  const result = schema.refine(value => value.NODE_ENV !== 'production' || value.APP_ORIGIN.startsWith('https://'), { path: ['APP_ORIGIN'] }).safeParse(input);
  if (!result.success) {
    // Never include values or a Zod error containing connection credentials.
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment variables: ${keys.join(', ')}. See .env.example.`);
  }
  return Object.freeze({ ...result.data, trustProxy: result.data.TRUST_PROXY === '1' ? 1 : false });
}
