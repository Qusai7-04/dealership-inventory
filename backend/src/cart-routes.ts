import { Router } from 'express';
import { authenticate } from './auth.js';
import { addCartItem, clearCart, getCart, removeCartItem } from './cart-service.js';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try {
    response.json(await getCart(request.user!.id));
  } catch (error) { next(error); }
});

router.post('/items', authenticate, async (request, response, next) => {
  try { response.json(await addCartItem(request.user!.id, request.body)); } catch (error) { next(error); }
});

router.delete('/items/:vehicleId', authenticate, async (request, response, next) => {
  try { response.json(await removeCartItem(request.user!.id, request.params.vehicleId as string)); } catch (error) { next(error); }
});

router.delete('/', authenticate, async (request, response, next) => {
  try { response.json(await clearCart(request.user!.id)); } catch (error) { next(error); }
});

export default router;
