import { z } from 'zod';

const name = z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120, 'El nombre es demasiado largo.');
export const email = z.string().trim().max(254).email('El correo electrónico no es válido.').transform(value => value.toLowerCase());
const password = z.string().min(12, 'La contraseña debe tener al menos 12 caracteres.').max(128, 'La contraseña admite hasta 128 caracteres.');
const credentials = { name, email, password, confirmPassword: z.string() };
const matching = value => value.password === value.confirmPassword;
const matchError = { message: 'Las contraseñas no coinciden.', path: ['confirmPassword'] };
export const registerSchema = z.object({ ...credentials, companyName: name }).strict().refine(matching, matchError);
export const employeeSchema = z.object(credentials).strict().refine(matching, matchError);
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const forgotSchema = z.object({ email }).strict();
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'El enlace no es válido o ha caducado.');
export const resetSchema = z.object({ token: tokenSchema, password, confirmPassword: z.string() }).strict().refine(matching, matchError);
