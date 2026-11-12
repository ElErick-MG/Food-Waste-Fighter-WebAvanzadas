import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const secret = () => randomBytes(32).toString('hex');
const mysqlPassword = secret();
const testPassword = secret();
const origin = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'}`
  : 'http://localhost:3000';
const values = {
  MYSQL_PASSWORD: mysqlPassword,
  MYSQL_ROOT_PASSWORD: secret(),
  DATABASE_URL: `mysql://fwf_app:${mysqlPassword}@127.0.0.1:3306/food_waste_fighter`,
  SESSION_SECRET: secret(),
  TEST_MYSQL_PASSWORD: testPassword,
  TEST_MYSQL_ROOT_PASSWORD: secret(),
  TEST_DATABASE_URL: `mysql://fwf_test:${testPassword}@127.0.0.1:3307/food_waste_fighter_test`,
  APP_ORIGIN: origin,
  TRUST_PROXY: process.env.CODESPACES === 'true' ? '1' : '0',
};
const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const content = template.replace(/^([A-Z_]+)=.*$/gm, (line, key) =>
  Object.hasOwn(values, key) ? `${key}=${values[key]}` : line);
try {
  writeFileSync(new URL('../.env', import.meta.url), content, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with unique development secrets. Existing database volumes retain their original credentials.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing .env preserved. Compare it with .env.example when configuration changes.');
}
