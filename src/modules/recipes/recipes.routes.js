import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireUser } from '../../middleware/security.js';
import { BusinessError, businessContext, businessErrors, pageNumber, pagination, readBusinessForm, readQuery, redirectWithNotice } from '../business.js';
import { createRecipesService } from './recipes.service.js';
import { recipeSchema } from './recipes.validation.js';

export function recipesRoutes({ database, config }) {
  const router = Router();
  const service = createRecipesService(database);
  router.use(requireUser, businessContext(config));
  router.get('/', async (req, res) => {
    const { page } = readQuery(z.strictObject({ page: pageNumber }), req.query);
    const { total, recipes } = await service.list(req.user.companyId, page);
    res.render('recipes/list', { recipes, pagination: pagination(total, page, '/recipes') });
  });
  router.get('/new', requireAdmin, (_req, res) => res.render('recipes/new', { values: {}, error: null }));
  router.post('/', requireAdmin, async (req, res) => {
    let input;
    try {
      input = readBusinessForm(recipeSchema, req.body);
    } catch (error) {
      if (!(error instanceof BusinessError)) throw error;
      const values = Object.fromEntries(['name', 'description', 'preparation', 'ingredients']
        .map(field => [field, typeof req.body[field] === 'string' ? req.body[field] : '']));
      return res.status(error.status).render('recipes/new', { values, error: error.message });
    }
    const { id } = await service.create(req.user.companyId, input);
    return redirectWithNotice(req, res, `/recipes/${id}`, 'Receta agregada.');
  });
  router.get('/:id', async (req, res) => res.render('recipes/detail', await service.detail(req.user.companyId, req.params.id, res.locals.today)));
  router.use(businessErrors);
  return router;
}
