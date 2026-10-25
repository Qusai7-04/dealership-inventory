import type { ApiClient } from '../../api/client';
import type { CartResponse, Vehicle } from '../../types/api';

export const addVehicleToCart = (api: ApiClient, vehicle: Vehicle) =>
  api.post<CartResponse>('/api/cart/items', { vehicleId: vehicle.id }).then(() => undefined);

export const saveVehicle = (api: ApiClient, vehicle: Vehicle) =>
  api.put(`/api/favourites/${vehicle.id}`, {}).then(() => undefined);

export const purchaseVehicle = (api: ApiClient, vehicle: Vehicle) =>
  api.post(`/api/vehicles/${vehicle.id}/purchase`, { requestId: crypto.randomUUID() }).then(() => undefined);
