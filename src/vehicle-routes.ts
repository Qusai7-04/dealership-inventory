import { Router } from 'express';
import { authenticate, requireRole } from './auth.js';
import { createVehicle, deleteVehicle, getVehicle, listVehicles, restockVehicle, updateVehicle } from './vehicle-service.js';

const router = Router();
const admin = [authenticate, requireRole('admin')];

router.get('/', async (request, response, next) => {
  try { response.json(await listVehicles(request.query)); } catch (error) { next(error); }
});
router.get('/search', async (request, response, next) => {
  try { response.json(await listVehicles(request.query)); } catch (error) { next(error); }
});
router.get('/:id', async (request, response, next) => {
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

export default router;
