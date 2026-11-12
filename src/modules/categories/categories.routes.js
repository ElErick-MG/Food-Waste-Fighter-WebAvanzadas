import { Router } from 'express';
import { requireUser, requireAdmin } from '../../middleware/security.js';
import { BusinessError, businessContext, businessErrors, categorySchema, confirmationSchema, missingRecord, readBusinessForm, redirectWithNotice } from '../business.js';

export function categoriesRoutes({ database, config }) {
  const router = Router();
  router.use(requireUser, businessContext(config));
  const find = async (companyId, id) => {
    const category = await database.category.findFirst({ where: { companyId, id } });
    if (!category) throw missingRecord();
    return category;
  };
  async function render(req, res, error = null, status = 200, values = {}) {
    const categories = await database.category.findMany({ where: { companyId: req.user.companyId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], include: { _count: { select: { items: true } } } });
    res.status(status).render('categories/list', { categories, error, values });
  }
  router.get('/', (req, res) => render(req, res));
  async function save(req, res) {
    if (req.params.id) await find(req.user.companyId, req.params.id);
    try {
      const input = readBusinessForm(categorySchema, req.body);
      if (req.params.id) {
        const result = await database.category.updateMany({ where: { id: req.params.id, companyId: req.user.companyId }, data: input });
        if (!result.count) throw missingRecord();
      } else await database.category.create({ data: { ...input, companyId: req.user.companyId } });
      return await redirectWithNotice(req, res, '/categories', req.params.id ? 'Categoría actualizada.' : 'Categoría creada.');
    } catch (error) {
      if (error.code === 'P2002') return render(req, res, 'Ya existe una categoría con ese nombre.', 409, { name: req.body.name, id: req.params.id });
      if (!(error instanceof BusinessError) || error.status === 404) throw error;
      return render(req, res, error.message, error.status, { name: req.body.name, id: req.params.id });
    }
  }
  router.post('/', requireAdmin, save);
  router.post('/:id/edit', requireAdmin, save);
  router.get('/:id/delete', requireAdmin, async (req, res) => res.render('categories/delete', { category: await find(req.user.companyId, req.params.id), error: null }));
  router.post('/:id/delete', requireAdmin, async (req, res) => {
    const category = await find(req.user.companyId, req.params.id);
    try {
      readBusinessForm(confirmationSchema, req.body);
      const result = await database.category.deleteMany({ where: { id: category.id, companyId: req.user.companyId } });
      if (!result.count) throw missingRecord();
      return await redirectWithNotice(req, res, '/categories', 'Categoría eliminada.');
    } catch (error) {
      if (error.code === 'P2003') return res.status(409).render('categories/delete', { category, error: 'La categoría tiene productos. Reasígnalos antes de eliminarla.' });
      if (!(error instanceof BusinessError) || error.status === 404) throw error;
      res.status(error.status).render('categories/delete', { category, error: error.message });
    }
  });
  router.use(businessErrors);
  return router;
}
