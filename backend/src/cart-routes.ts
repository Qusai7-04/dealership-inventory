import { Router } from 'express';
import { authenticate } from './auth.js';
import { query } from './db.js';

const router = Router();

router.get('/', authenticate, async (request, response, next) => {
  try {
    const cart = await query<{ id: string }>('SELECT id FROM carts WHERE user_id = $1', [request.user!.id]);
    response.json({ cart: cart.rows[0] ?? null, items: [], itemCount: 0, subtotal: '0.00' });
  } catch (error) { next(error); }
});

export default router;
