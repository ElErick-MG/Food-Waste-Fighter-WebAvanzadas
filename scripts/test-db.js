import 'dotenv/config';
import { spawnSync } from 'node:child_process';

import { isolatedDatabaseUrl } from './lib/test-database.js';

// Validate before issuing any migration command; never fall back to development.
const testUrl = isolatedDatabaseUrl();
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl };
for (const args of [
  ['prisma', 'migrate', 'deploy'],
  ['vitest', 'run', 'tests/database.integration.test.js', 'tests/auth.integration.test.js', 'tests/business.integration.test.js', 'tests/chat.integration.test.js'],
]) {
  const result = spawnSync('npx', ['--no-install', ...args], { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
