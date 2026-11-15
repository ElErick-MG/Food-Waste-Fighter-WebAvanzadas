// Data for the fridge view (front-end redesign, stage 4). Read-only: the client only
// draws it. Expiration state and days are computed here with the business date, so
// the browser's own timezone never changes what is "expired" or "critical".
import { dateInput, expiration } from '../expiration/expiration.js';
import { SHELF_LIMIT } from './inventory.repository.js';

// Server status filter (?status=) → fridge filter name.
const STATUS_FILTER = { '': 'todos', soon: 'proximos', expired: 'caducados', critical: 'criticos', warning: 'advertencia', normal: 'normal', low: 'stock' };

export function shelfData({ items, categories, today, filters, user }) {
  return {
    hoy: dateInput(today),
    puedeEliminar: user.role === 'ADMIN',
    puedeCategorias: user.role === 'ADMIN',
    limite: items.length >= SHELF_LIMIT ? SHELF_LIMIT : null,
    filtro: { estado: STATUS_FILTER[filters.status] ?? 'todos', categoria: filters.categoryId || null },
    categorias: categories.map(category => ({ id: category.id, nombre: category.name, color: category.color })),
    productos: items.map(item => {
      const state = expiration(item.expiresDate, today);
      return {
        id: item.id, nombre: item.name, categoriaId: item.categoryId,
        cantidad: String(item.quantity), unidad: item.unit, stockMin: String(item.minimumStock),
        bajo: item.quantity.lte(item.minimumStock),
        ingreso: dateInput(item.receivedDate), caducidad: dateInput(item.expiresDate),
        dias: state.days, estado: state.code, imagen: item.imageUrl || null,
      };
    }),
  };
}

/** JSON safe to embed in <script type="application/json">: no "<" can close the element. */
export const jsonIsland = data => JSON.stringify(data)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
