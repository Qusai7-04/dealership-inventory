import { Router } from 'express';
import { authenticate } from './auth.js';
import { listNotifications, markNotificationRead } from './notification-service.js';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try { response.json(await listNotifications(request.user!.id, request.query)); } catch (error) { next(error); }
});

router.patch('/:id/read', authenticate, async (request, response, next) => {
  try { response.json(await markNotificationRead(request.user!.id, request.params.id as string)); } catch (error) { next(error); }
});

export default router;
