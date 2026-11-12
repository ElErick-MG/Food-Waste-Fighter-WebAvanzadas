import { Router } from 'express';
import { requireUser, requireAdmin } from '../../middleware/security.js';
import { BusinessError, businessContext, businessErrors, confirmationSchema, pagination, readBusinessForm, readQuery, redirectWithNotice } from '../business.js';
import { dateInput } from '../expiration/expiration.js';
import { foodSchema, inventoryQuery } from './inventory.validation.js';
import { createInventoryService } from './inventory.service.js';

export function inventoryRoutes({ database, config, expirationPage = false }) {
  const router = Router();
  const service = createInventoryService(database);
  router.use(requireUser, businessContext(config));
  router.get('/', async (req, res) => {
    const filters = readQuery(inventoryQuery, req.query);
    if (filters.categoryId && !await service.category(req.user.companyId, filters.categoryId)) throw new BusinessError('Selecciona una categoría de tu empresa.');
    const { total, items } = await service.list(req.user.companyId, filters, res.locals.today);
    res.render('inventory/list', { items, filters, categories: await service.categories(req.user.companyId), expirationPage,
      pagination: pagination(total, filters.page, expirationPage ? '/expiration' : '/inventory', { q: filters.q, categoryId: filters.categoryId, status: filters.status }) });
  });
  if (!expirationPage) {
    const form = async (req, res, values, error = null, status = 200) => {
      res.status(status).render('inventory/form', { values, error, editing: Boolean(req.params.id), id: req.params.id,
        categories: await service.categories(req.user.companyId) });
    };
    router.get('/new', (req, res) => form(req, res, { receivedDate: dateInput(res.locals.today), minimumStock: '0', unit: 'kg' }));
    router.get('/:id', async (req, res) => res.render('inventory/detail', { item: await service.find(req.user.companyId, req.params.id) }));
    router.get('/:id/edit', async (req, res) => {
      const item = await service.find(req.user.companyId, req.params.id);
      return form(req, res, { ...item, quantity: String(item.quantity), minimumStock: String(item.minimumStock), receivedDate: dateInput(item.receivedDate), expiresDate: dateInput(item.expiresDate) });
    });
    async function save(req, res) {
      // Authorize the target before parsing a submitted update or re-rendering it.
      if (req.params.id) await service.find(req.user.companyId, req.params.id);
      try {
        const item = await service.save(req.user.companyId, readBusinessForm(foodSchema, req.body), req.params.id);
        await req.app.locals.realtime?.inventoryChanged(req.user.companyId, item.id, req.params.id ? 'updated' : 'created');
        return await redirectWithNotice(req, res, `/inventory/${item.id}`, req.params.id ? 'Producto actualizado.' : 'Producto registrado.');
      } catch (error) {
        if (!(error instanceof BusinessError) || error.status === 404) throw error;
        const values = Object.fromEntries(Object.keys(foodSchema.shape).map(key => [key, typeof req.body[key] === 'string' ? req.body[key] : '']));
        return form(req, res, values, error.message, error.status);
      }
    }
    router.post('/', save);
    router.post('/:id/edit', save);
    router.get('/:id/delete', requireAdmin, async (req, res) => res.render('inventory/delete', { item: await service.find(req.user.companyId, req.params.id), error: null }));
    router.post('/:id/delete', requireAdmin, async (req, res) => {
      const item = await service.find(req.user.companyId, req.params.id);
      try { readBusinessForm(confirmationSchema, req.body); }
      catch (error) { if (!(error instanceof BusinessError)) throw error; return res.status(400).render('inventory/delete', { item, error: error.message }); }
      await service.remove(req.user.companyId, item.id);
      await req.app.locals.realtime?.inventoryChanged(req.user.companyId, item.id, 'deleted');
      return redirectWithNotice(req, res, '/inventory', 'Producto eliminado.');
    });
  }
  router.use(businessErrors);
  return router;
}
