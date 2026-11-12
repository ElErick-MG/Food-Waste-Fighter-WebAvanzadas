import { Router } from 'express';

export function systemRoutes({ checkDatabase }) {
  const router = Router();
  router.get('/', (_req, res) => res.render('home', { title: 'Food Waste Fighter' }));
  router.get('/health', (_req, res) => res.json({ status: 'ok' }));
  router.get('/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await checkDatabase();
      res.json({ status: 'ready', database: 'up' });
    } catch {
      res.status(503).json({ status: 'unavailable', database: 'down' });
    }
  });
  return router;
}
