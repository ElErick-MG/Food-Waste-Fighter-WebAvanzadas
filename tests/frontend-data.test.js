import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { foodSchema } from '../src/modules/inventory/inventory.validation.js';
import { categorySchema } from '../src/modules/business.js';
import { CATEGORY_COLORS, defaultCategoryColor } from '../src/modules/categories/category-colors.js';

// Front-end redesign, stage 2: optional product image (HTTPS URL) and category color.
const valid = { name: 'Zanahoria', categoryId: 'demo-category', quantity: '2.125', minimumStock: '0', unit: 'kg', receivedDate: '2026-11-01', expiresDate: '2026-11-07' };

describe('Product image URL (optional, HTTPS only)', () => {
  it('stays optional so existing forms keep working and leave the stored image untouched', () => {
    expect(foodSchema.parse(valid).imageUrl).toBeUndefined();
  });
  it('accepts absolute HTTPS URLs and an empty value that removes the image', () => {
    expect(foodSchema.parse({ ...valid, imageUrl: ' https://images.example.com/leche.jpg?w=480 ' }).imageUrl).toBe('https://images.example.com/leche.jpg?w=480');
    expect(foodSchema.parse({ ...valid, imageUrl: '' }).imageUrl).toBeNull();
  });
  it.each([
    'http://images.example.com/leche.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//images.example.com/a.jpg',
    '/assets/fwf/img/productos/leche.jpg', 'https://user:secret@images.example.com/a.jpg', 'https://localhost/a.jpg',
    `https://images.example.com/${'a'.repeat(480)}`, 'no es una url',
  ])('rejects %s', imageUrl => expect(foodSchema.safeParse({ ...valid, imageUrl }).success).toBe(false));
});

describe('Category color (optional hex, palette default)', () => {
  it('normalizes #RRGGBB and treats empty or missing as "keep / use default"', () => {
    expect(categorySchema.parse({ name: 'Lácteos', color: '#4a7fd6' }).color).toBe('#4A7FD6');
    expect(categorySchema.parse({ name: 'Lácteos', color: '' }).color).toBeUndefined();
    expect(categorySchema.parse({ name: 'Lácteos' }).color).toBeUndefined();
  });
  it.each(['red', '#fff', '#12345G', 'url(x)', '#1234567'])('rejects %s', color =>
    expect(categorySchema.safeParse({ name: 'Lácteos', color }).success).toBe(false));
  it('cycles the palette for new categories', () => {
    expect(defaultCategoryColor(0)).toBe(CATEGORY_COLORS[0]);
    expect(defaultCategoryColor(CATEGORY_COLORS.length + 1)).toBe(CATEGORY_COLORS[1]);
    for (const color of CATEGORY_COLORS) expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('CSP after stage 2', () => {
  const config = parseEnv({ NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: 'mysql://unit:synthetic@127.0.0.1:3306/unit_test', SESSION_SECRET: 'a'.repeat(32) });
  it('widens only img-src with https: for product images', async () => {
    const csp = (await request(createApp({ config, checkDatabase: vi.fn().mockResolvedValue(undefined) })).get('/')).headers['content-security-policy'];
    const directive = name => csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `));
    expect(directive('img-src')).toBe("img-src 'self' https:");
    for (const name of ['default-src', 'script-src', 'style-src']) expect(directive(name)).toBe(`${name} 'self'`);
  });
});
