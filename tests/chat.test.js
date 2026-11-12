import { describe, it, expect } from 'vitest';
import { socketOriginAllowed } from '../src/modules/chat/chat.socket.js';

describe('Socket origin policy behind the Codespaces HTTPS proxy', () => {
  const config = { APP_ORIGIN: 'https://forwarded.example', trustProxy: 1 };
  const headers = { origin: 'https://upstream.example', 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin' };
  it('accepts exact public origin and bounded browser same-origin proxy metadata', () => {
    expect(socketOriginAllowed({ headers: { origin: config.APP_ORIGIN } }, config)).toBe(true);
    expect(socketOriginAllowed({ headers }, config)).toBe(true);
    expect(socketOriginAllowed({ headers: { 'sec-fetch-site': 'same-origin' }, _query: { transport: 'polling' } }, { ...config, trustProxy: false })).toBe(true);
    expect(socketOriginAllowed({ headers: { 'sec-fetch-site': 'same-origin' }, _query: { transport: 'websocket' } }, { ...config, trustProxy: false })).toBe(false);
  });
  it('rejects missing metadata, cross-site, same-site, untrusted and plain HTTP alternatives', () => {
    for (const overrides of [{ 'sec-fetch-site': undefined }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }, { 'x-forwarded-proto': 'http' }]) expect(socketOriginAllowed({ headers: { ...headers, ...overrides } }, config)).toBe(false);
    expect(socketOriginAllowed({ headers }, { ...config, trustProxy: false })).toBe(false);
    expect(socketOriginAllowed({ headers: {} }, config)).toBe(false);
  });
});
