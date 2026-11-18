import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../../middleware/security.js';
import { businessContext, businessErrors, pageNumber, pagination, readQuery } from '../business.js';
import { createRecipesService } from './recipes.service.js';

export function recipesRoutes({ database, config }) {
  const router = Router();
  const service = createRecipesService(database);
  router.use(requireUser, businessContext(config));
  router.get('/', async (req, res) => {
    const { page } = readQuery(z.strictObject({ page: pageNumber }), req.query);
    const companyId = req.user.companyId;
    const [{ total, recipes }, suggested] = await Promise.all([
      service.list(companyId, page),
      service.suggestedFromInventory(companyId, res.locals.today),
    ]);
    res.render('recipes/list', { recipes, suggested, pagination: pagination(total, page, '/recipes') });
  });
  router.get('/:id', async (req, res) => res.render('recipes/detail', await service.detail(req.user.companyId, req.params.id, res.locals.today)));
  router.use(businessErrors);
  return router;
}
