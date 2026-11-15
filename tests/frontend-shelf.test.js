import { describe, expect, it } from 'vitest';
import { jsonIsland, shelfData } from '../src/modules/inventory/inventory.shelf.js';

// Front-end redesign, stage 4: read-only data for the fridge view.
const today = new Date('2026-11-15T00:00:00Z');
const day = n => new Date(today.getTime() + n * 86400000);
const decimal = (value, low = false) => ({ lte: () => low, toString: () => value });
const item = { id: 'a', name: 'Leche', categoryId: 'c', quantity: decimal('2.125', true), minimumStock: decimal('3'), unit: 'l', receivedDate: day(-4), expiresDate: day(2), imageUrl: null };

describe('Fridge data (stage 4)', () => {
  it('computes state and days with the business date and maps server filters', () => {
    const data = shelfData({ items: [item], categories: [{ id: 'c', name: 'Lácteos', color: '#4A7FD6' }], today, filters: { status: 'low', categoryId: 'c' }, user: { role: 'EMPLOYEE' } });
    expect(data.hoy).toBe('2026-11-15');
    expect(data.productos[0]).toMatchObject({ id: 'a', cantidad: '2.125', stockMin: '3', bajo: true, dias: 2, estado: 'critical', ingreso: '2026-11-11', caducidad: '2026-11-17', imagen: null });
    expect(data.filtro).toEqual({ estado: 'stock', categoria: 'c' });
    expect(data.puedeEliminar).toBe(false);
    expect(data.limite).toBeNull();
  });
  it('produces JSON that cannot close the <script> element', () => {
    const island = jsonIsland({ nombre: '</script><script>alert(1)</script>', otro: 'a & b  ' });
    expect(island).not.toContain('<');
    expect(island).not.toContain('>');
    expect(island).not.toContain('&');
    expect(JSON.parse(island)).toEqual({ nombre: '</script><script>alert(1)</script>', otro: 'a & b  ' });
  });
});
