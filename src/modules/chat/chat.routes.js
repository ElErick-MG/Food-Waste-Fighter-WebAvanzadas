import { Router } from 'express';
import { requireUser } from '../../middleware/security.js';
import { businessContext, businessErrors } from '../business.js';
import { createChatService } from './chat.service.js';

export function chatRoutes({ database, config }) {
  const router = Router();
  const service = createChatService(database);
  router.use(requireUser, businessContext(config));
  router.get('/', async (req, res) => {
    const room = await service.general(req.user.companyId);
    res.render('chat/index', { room, history: await service.history(req.user.companyId, { roomId: room.id }) });
  });
  router.use(businessErrors);
  return router;
}
