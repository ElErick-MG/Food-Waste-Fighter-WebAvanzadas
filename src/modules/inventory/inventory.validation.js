import { z } from 'zod';
import { identifier, pageNumber } from '../business.js';

const decimal = z.string().trim().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/, 'Usa un número entre 0 y 999999999.999, con hasta 3 decimales y punto decimal.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escribe una fecha válida.').refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return value >= '1000-01-01' && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Escribe una fecha válida (año 1000–9999).');
export const foodSchema = z.strictObject({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120, 'El nombre admite hasta 120 caracteres.'),
  categoryId: identifier,
  quantity: decimal,
  unit: z.enum(['kg', 'g', 'l', 'ml', 'unidad'], { error: 'Selecciona una unidad válida.' }),
  minimumStock: decimal,
  receivedDate: date,
  expiresDate: date,
}).refine(value => value.receivedDate <= value.expiresDate, { message: 'La caducidad no puede ser anterior al ingreso.', path: ['expiresDate'] });
export const inventoryQuery = z.strictObject({
  q: z.string().trim().max(80).default(''),
  categoryId: identifier.or(z.literal('')).default(''),
  status: z.enum(['', 'soon', 'expired', 'critical', 'warning', 'normal', 'low']).default(''),
  page: pageNumber,
});
