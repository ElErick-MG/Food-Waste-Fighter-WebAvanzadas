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
    const { total, recipes } = await service.list(req.user.companyId, page);
    res.render('recipes/list', { recipes, pagination: pagination(total, page, '/recipes') });
  });
  router.get('/:id', async (req, res) => res.render('recipes/detail', await service.detail(req.user.companyId, req.params.id, res.locals.today)));
  router.use(businessErrors);
  return router;
}
