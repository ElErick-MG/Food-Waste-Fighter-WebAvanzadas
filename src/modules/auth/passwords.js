import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

// OWASP Argon2id minimum: 19 MiB, two iterations, one parallel lane.
const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
export const hashPassword = password => argon2.hash(password, options);
const dummyHash = hashPassword(randomBytes(32).toString('hex'));
export async function verifyPassword(passwordHash, password) {
  return argon2.verify(passwordHash || await dummyHash, password);
}
