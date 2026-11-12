import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthError, createAuthService } from './auth.service.js';
import { registerSchema, loginSchema, forgotSchema, resetSchema, tokenSchema } from './auth.validation.js';

const formInput = body => {
  const { _csrf, ...input } = body;
  return input;
};
export const readForm = (schema, body) => schema.safeParse(formInput(body));
export const formError = result => result.error.issues[0]?.message || 'Los datos no son válidos.';
export function authLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => res.status(429).render('error', { title: 'Demasiados intentos', message: 'Espera unos minutos antes de intentarlo de nuevo.' }),
  });
}
async function beginSession(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.auth = { userId: user.id, version: user.sessionVersion };
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}
export function authRoutes({ database, config, sendResetMail }) {
  const router = Router();
  const service = createAuthService(database, config, sendResetMail);
  const render = (res, view, error = null, values = {}, status = 200, message = null) =>
    res.status(status).render(`auth/${view}`, { error, values, message });
  router.get('/login', (_req, res) => render(res, 'login'));
  router.get('/register', (_req, res) => render(res, 'register'));
  router.get('/forgot', (_req, res) => render(res, 'forgot'));
  router.post('/register', authLimiter(10), async (req, res) => {
    const result = readForm(registerSchema, req.body);
    const values = { name: req.body.name, email: req.body.email, companyName: req.body.companyName };
    if (!result.success) return render(res, 'register', formError(result), values, 400);
    try {
      const user = await service.register(result.data);
      await beginSession(req, user);
      res.redirect(303, '/dashboard');
    } catch (error) {
      if (error.code === 'P2002') return render(res, 'register', 'No se puede registrar ese correo. Prueba a iniciar sesión o recuperar tu contraseña.', values, 409);
      throw error;
    }
  });
  router.post('/login', authLimiter(10), async (req, res) => {
    const result = readForm(loginSchema, req.body);
    const values = { email: req.body.email };
    if (!result.success) return render(res, 'login', formError(result), values, 400);
    try {
      await beginSession(req, await service.login(result.data));
      res.redirect(303, '/dashboard');
    } catch (error) {
      if (error instanceof AuthError) return render(res, 'login', error.message, values, 401);
      throw error;
    }
  });
  router.post('/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('fwf.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: new URL(config.APP_ORIGIN).protocol === 'https:' });
    res.redirect(303, '/auth/login');
  });
  router.post('/forgot', authLimiter(10), async (req, res) => {
    const result = readForm(forgotSchema, req.body);
    if (!result.success) return render(res, 'forgot', formError(result), {}, 400);
    try { await service.requestReset(result.data.email); }
    catch { console.error('Password recovery delivery failed.'); }
    render(res, 'forgot', null, {}, 200, 'Si existe una cuenta con ese correo, se enviará un enlace para recuperar la contraseña.');
  });
  router.get('/reset', (req, res) => {
    res.set('Referrer-Policy', 'no-referrer');
    const token = tokenSchema.safeParse(req.query.token);
    render(res, 'reset', token.success ? null : 'El enlace no es válido o ha caducado.', { token: token.success ? token.data : '' }, token.success ? 200 : 400);
  });
  router.post('/reset', authLimiter(10), async (req, res) => {
    const result = readForm(resetSchema, req.body);
    const token = tokenSchema.safeParse(req.body.token);
    const values = { token: token.success ? token.data : '' };
    if (!result.success) return render(res, 'reset', formError(result), values, 400);
    try {
      await service.resetPassword(result.data);
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      res.clearCookie('fwf.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: new URL(config.APP_ORIGIN).protocol === 'https:' });
      res.redirect(303, '/auth/login');
    } catch (error) {
      if (error instanceof AuthError) return render(res, 'reset', error.message, values, 400);
      throw error;
    }
  });
  return router;
}
