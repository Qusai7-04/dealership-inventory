import { Router } from 'express';
import { authenticate } from './auth.js';
import { listFavourites, saveFavourite } from './favourite-service.js';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try { response.json(await listFavourites(request.user!.id)); } catch (error) { next(error); }
});

router.put('/:vehicleId', authenticate, async (request, response, next) => {
  try { response.json(await saveFavourite(request.user!.id, request.params.vehicleId as string)); } catch (error) { next(error); }
});

export default router;
