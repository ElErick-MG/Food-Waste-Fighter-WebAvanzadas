import { Router } from 'express';
import { requireUser } from '../../middleware/security.js';
import { businessContext } from '../business.js';
import { expirationWhere } from '../expiration/expiration.js';
import { createRecipesService } from '../recipes/recipes.service.js';

export function dashboardRoutes({ database, config }) {
  const router = Router();
  router.use(requireUser, businessContext(config));
  router.get('/', async (req, res) => {
    const companyId = req.user.companyId;
    const today = res.locals.today;
    const food = database.foodItem;
    const [total, soon, expired, low, alerts] = await database.$transaction([
      food.count({ where: { companyId } }),
      food.count({ where: { companyId, ...expirationWhere('soon', today) } }),
      food.count({ where: { companyId, ...expirationWhere('expired', today) } }),
      food.count({ where: { companyId, quantity: { lte: food.fields.minimumStock } } }),
      // Same three soonest items; the category name/color only decorates the alert row.
      food.findMany({ where: { companyId }, orderBy: [{ expiresDate: 'asc' }, { id: 'asc' }], take: 3, include: { category: { select: { name: true, color: true } } } }),
    ]);
    const suggested = await createRecipesService(database).suggestedFromInventory(companyId, today);
    // ?desde=portada only plays the arrival animation from the landing page; it reads no data.
    res.render('dashboard', { metrics: { total, soon, expired, low }, alerts, suggested, transicion: req.query.desde === 'portada' });
  });
  return router;
}
