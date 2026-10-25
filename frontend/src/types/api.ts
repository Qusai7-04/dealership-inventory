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
