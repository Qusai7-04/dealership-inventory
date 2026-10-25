import { Router } from 'express';
import { authenticate, requireRole } from './auth.js';
import { createVehicle, deleteVehicle, generateVehicleImage, getVehicle, listVehicles, restockVehicle, updateVehicle } from './vehicle-service.js';
import { directPurchase } from './purchase-service.js';
import { listStockReceipts } from './read-model-service.js';

const router = Router();
const admin = [authenticate, requireRole('admin')];

router.get('/', authenticate, async (request, response, next) => {
  try { response.json(await listVehicles(request.query)); } catch (error) { next(error); }
});
router.get('/search', authenticate, async (request, response, next) => {
  try { response.json(await listVehicles(request.query)); } catch (error) { next(error); }
});
router.get('/:id', authenticate, async (request, response, next) => {
  try { response.json({ vehicle: await getVehicle(request.params.id as string) }); } catch (error) { next(error); }
});
router.post('/', ...admin, async (request, response, next) => {
  try { response.status(201).json({ vehicle: await createVehicle(request.body, request.user!.id) }); } catch (error) { next(error); }
});
router.put('/:id', ...admin, async (request, response, next) => {
  try { response.json({ vehicle: await updateVehicle(request.params.id as string, request.body) }); } catch (error) { next(error); }
});
router.delete('/:id', ...admin, async (request, response, next) => {
  try { await deleteVehicle(request.params.id as string); response.status(204).send(); } catch (error) { next(error); }
});
router.post('/:id/restock', ...admin, async (request, response, next) => {
  try { response.json({ vehicle: await restockVehicle(request.params.id as string, request.body, request.user!.id) }); } catch (error) { next(error); }
});
router.get('/:id/stock-receipts', ...admin, async (request, response, next) => {
  try { response.json(await listStockReceipts(request.params.id as string, request.query)); } catch (error) { next(error); }
});
router.post('/:id/generate-image', ...admin, async (request, response, next) => {
  try {
    const result = await generateVehicleImage(request.params.id as string);
    response.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});
router.post('/:id/purchase', authenticate, async (request, response, next) => {
  try { response.json({ purchase: await directPurchase(request.user!.id, request.params.id as string, request.body) }); } catch (error) { next(error); }
});

export default router;
