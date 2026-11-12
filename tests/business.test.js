import { describe, expect, it } from 'vitest';
import { addDays, businessToday, dateInput, displayDate, expiration } from '../src/modules/expiration/expiration.js';
import { foodSchema } from '../src/modules/inventory/inventory.validation.js';
import { ingredientMatches } from '../src/modules/recipes/recipes.service.js';

describe('Civil expiration dates and the original business thresholds', () => {
  const today = new Date('2026-11-07T00:00:00Z');
  it.each([[-1, 'expired'], [0, 'critical'], [2, 'critical'], [3, 'warning'], [5, 'warning'], [6, 'normal']])('classifies the day offset %i as %s', (offset, code) => {
    expect(expiration(addDays(today, offset), today).code).toBe(code);
    expect(expiration(addDays(today, offset), today).days).toBe(offset);
  });
  it('uses the configured business day across a UTC midnight, without shifting SQL DATE display', () => {
    const now = new Date('2026-11-07T02:00:00Z');
    expect(dateInput(businessToday('America/Guayaquil', now))).toBe('2026-11-06');
    expect(dateInput(businessToday('Asia/Tokyo', now))).toBe('2026-11-07');
    expect(displayDate(today)).toBe('07/11/2026');
  });
  it('handles DST and leap-day transitions as civil days', () => {
    expect(dateInput(businessToday('America/New_York', new Date('2026-03-08T06:59:00Z')))).toBe('2026-03-08');
    expect(dateInput(businessToday('America/New_York', new Date('2026-03-08T07:01:00Z')))).toBe('2026-03-08');
    expect(expiration(new Date('2028-03-01T00:00:00Z'), new Date('2028-02-28T00:00:00Z')).days).toBe(2);
  });
});
describe('Food validation protects DECIMAL/DATE limits before persistence', () => {
  const valid = { name: 'Zanahoria', categoryId: 'demo-category', quantity: '2.125', minimumStock: '0.001', unit: 'kg', receivedDate: '2026-11-01', expiresDate: '2026-11-07' };
  it('accepts exact decimal strings including the upper MySQL bound and zero stock', () => {
    expect(foodSchema.parse(valid).quantity).toBe('2.125');
    expect(foodSchema.safeParse({ ...valid, quantity: '999999999.999', minimumStock: '0' }).success).toBe(true);
  });
  it.each([
    { quantity: '-1' }, { quantity: '0.0001' }, { quantity: '1000000000' }, { quantity: '2,5' },
    { quantity: '' }, { minimumStock: 'NaN' }, { unit: 'invented' },
    { receivedDate: '2026-02-29' }, { expiresDate: '2026-10-01' }, { expiresDate: '0999-01-01' },
    { name: 'x'.repeat(121) }, { companyId: 'foreign' }, { inventoryId: 'foreign' },
  ])('rejects invalid inventory input %j', override => expect(foodSchema.safeParse({ ...valid, ...override }).success).toBe(false));
});
describe('Retained recipe overlap', () => {
  it('matches names case-insensitively in either direction but never empty names', () => {
    expect(ingredientMatches('Zanahoria', 'ZANAHORIA fresca')).toBe(true);
    expect(ingredientMatches('Zanahoria fresca', 'zanahoria')).toBe(true);
    expect(ingredientMatches('Zanahoria', 'Leche')).toBe(false);
    expect(ingredientMatches('', 'Leche')).toBe(false);
  });
});
