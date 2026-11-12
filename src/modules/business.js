import { z } from 'zod';
import { businessToday, dateInput, displayDate, expiration } from './expiration/expiration.js';

export class BusinessError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const missingRecord = () => new BusinessError('El registro no existe o no pertenece a tu empresa.', 404);
export const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,30}$/, 'Selecciona una categoría válida.');
export const pageNumber = z.string().regex(/^[1-9]\d{0,4}$/, 'La página no es válida.').default('1').transform(Number);
export const PAGE_SIZE = 10;
export const categorySchema = z.strictObject({ name: z.string().trim().min(2, 'Escribe un nombre de al menos 2 caracteres.').max(80, 'El nombre admite hasta 80 caracteres.') });
export const confirmationSchema = z.strictObject({ confirm: z.literal('yes', { error: 'Confirma la eliminación para continuar.' }) });
export function readBusinessForm(schema, body) {
  const { _csrf, ...fields } = body;
  const result = schema.safeParse(fields);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue?.code === 'unrecognized_keys' ? 'El formulario contiene datos no permitidos.'
      : issue?.code === 'invalid_type' ? 'Completa todos los campos con el formato solicitado.'
      : issue?.message || 'Revisa los datos del formulario.';
    throw new BusinessError(message);
  }
  return result.data;
}
export function readQuery(schema, query) {
  const result = schema.safeParse(query);
  if (!result.success) throw new BusinessError('Los filtros o la página no son válidos.');
  return result.data;
}
export function businessContext(config) {
  return async (req, res, next) => {
    const today = businessToday(config.BUSINESS_TIMEZONE);
    Object.assign(res.locals, {
      today, dateInput, displayDate, expiration: date => expiration(date, today),
      businessTimezone: config.BUSINESS_TIMEZONE,
      // Server-held flash messages cannot be supplied through a URL parameter.
      message: req.session.notice || null,
    });
    if (req.session.notice) {
      delete req.session.notice;
      await saveSession(req);
    }
    next();
  };
}
function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}
export async function redirectWithNotice(req, res, path, message) {
  req.session.notice = message;
  // express-session can flush redirect headers while its implicit save is
  // pending. Commit before sending any headers so a native browser sees it.
  await saveSession(req);
  return res.redirect(303, path);
}
export function businessErrors(error, _req, res, next) {
  if (!(error instanceof BusinessError)) return next(error);
  res.status(error.status).render('error', { title: 'Solicitud no completada', message: error.message });
}
export function pagination(total, page, path, filters = {}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = number => `${path}?${new URLSearchParams({ ...filters, page: String(number) })}`;
  return { total, page, pages, previous: page > 1 ? link(page - 1) : null, next: page < pages ? link(page + 1) : null };
}
