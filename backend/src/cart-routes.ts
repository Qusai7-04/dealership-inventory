import { Router } from 'express';
import { authenticate } from './auth.js';
import { addCartItem, getCart } from './cart-service.js';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try {
    response.json(await getCart(request.user!.id));
  } catch (error) { next(error); }
});

router.post('/items', authenticate, async (request, response, next) => {
  try { response.json(await addCartItem(request.user!.id, request.body)); } catch (error) { next(error); }
});

export default router;
