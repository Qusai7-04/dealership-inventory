import { Router } from 'express';
import { authenticate, requireRole } from './auth.js';
import { inventorySummary, listCategories, listPurchases } from './read-model-service.js';

export const categoryRouter = Router();
categoryRouter.get('/', authenticate, async (_request, response, next) => {
  try { response.json(await listCategories()); } catch (error) { next(error); }
});

export const purchaseRouter = Router();
purchaseRouter.get('/', authenticate, async (request, response, next) => {
  try { response.json(await listPurchases(request.user!.id, request.query)); } catch (error) { next(error); }
});

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.get('/inventory-summary', async (_request, response, next) => {
  try { response.json(await inventorySummary()); } catch (error) { next(error); }
});
