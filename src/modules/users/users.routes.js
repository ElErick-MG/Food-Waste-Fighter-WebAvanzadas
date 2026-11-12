import { Router } from 'express';
import { requireUser, requireAdmin } from '../../middleware/security.js';
import { createAuthService } from '../auth/auth.service.js';
import { employeeSchema } from '../auth/auth.validation.js';
import { authLimiter, readForm, formError } from '../auth/auth.routes.js';

export function usersRoutes({ database, config }) {
  const router = Router();
  const service = createAuthService(database, config);
  router.use(requireUser, requireAdmin);
  async function render(req, res, error = null, status = 200) {
    const users = await database.user.findMany({
      where: { companyId: req.user.companyId }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(status).render('users/team', { users, error });
  }
  router.get('/', (req, res) => render(req, res));
  router.post('/', authLimiter(10), async (req, res) => {
    const result = readForm(employeeSchema, req.body);
    if (!result.success) return render(req, res, formError(result), 400);
    try {
      await service.addEmployee(req.user.companyId, result.data);
      res.redirect(303, '/team');
    } catch (error) {
      if (error.code === 'P2002') return render(req, res, 'Ese correo no está disponible.', 409);
      throw error;
    }
  });
  return router;
}
