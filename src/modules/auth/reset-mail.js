import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Local simulation only. This directory is ignored and is never served over HTTP.
export async function deliverResetMail({ email, link }) {
  const directory = new URL('../../../work/outbox/', import.meta.url);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(new URL(`${randomUUID()}.json`, directory), JSON.stringify({ to: email, link }), { mode: 0o600, flag: 'wx' });
}
