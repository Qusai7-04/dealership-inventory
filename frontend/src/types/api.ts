export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  isActive: boolean;
}

export interface VehicleImage {
  id: string;
  url: string;
  altText: string;
  displayOrder: number;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: { id: number; name: string };
  price: string;
  quantity: number;
  lowStockThreshold: number;
  images: VehicleImage[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  pagination: Pagination;
}

export interface Category { id: number; name: string }
export interface CartItem { vehicleId: string; label: string; price: string; stock: number; available: boolean }
export interface CartResponse { cart: { id: string } | null; items: CartItem[]; itemCount: number; subtotal: string }
export interface Favourite {
  vehicleId: string; make: string; model: string; price: string; stock: number;
  available: boolean; deleted: boolean; notifyOnRestock: boolean; createdAt: string;
}
export interface Notification {
  id: string; type: string; message: string; vehicleId: string | null;
  createdAt: string; readAt: string | null; read: boolean;
}
export interface PurchaseItem { vehicleId: string; vehicleLabel: string; unitPrice: string }
export interface Purchase {
  id: string; source: 'direct' | 'cart'; totalPrice: string; purchasedAt: string; items: PurchaseItem[];
}
export interface StockReceipt {
  id: string; actorId: string; actorName: string; kind: 'opening' | 'restock';
  quantityAdded: number; resultingQuantity: number; requestId: string | null; createdAt: string;
}
export interface InventorySummary {
  activeStockLines: number; inStockLines: number; lowStockLines: number;
  outOfStockLines: number; totalUnits: number;
}
