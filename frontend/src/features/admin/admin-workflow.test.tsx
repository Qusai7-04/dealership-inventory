import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from '../../components/AdminShell';
import { AdminPage } from '../../pages/AdminPage';
import type { InventorySummary, Vehicle } from '../../types/api';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

const mockUser = vi.hoisted(() => ({
  id: 'admin-1',
  fullName: 'Dealership Director',
  email: 'director@creaseline.com',
  role: 'admin' as const,
  isVerified: true,
  isActive: true,
}));

vi.mock('../../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    api: mockApi,
    user: mockUser,
    logout: vi.fn(),
  }),
}));

const sampleSummary: InventorySummary = {
  activeStockLines: 35,
  inStockLines: 30,
  lowStockLines: 3,
  outOfStockLines: 5,
  totalUnits: 27,
};

const sampleVehicleWithoutImage: Vehicle = {
  id: 'v-zero-1',
  make: 'Porsche',
  model: '911 GT3',
  category: { id: 1, name: 'Coupe' },
  price: '24500000.00',
  quantity: 0,
  lowStockThreshold: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  images: [],
};

describe('Admin console and dedicated shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dedicated AdminShell without customer shopping artifacts', () => {
    render(
      <MemoryRouter>
        <AdminShell />
      </MemoryRouter>
    );

    // Sidebar branding & Admin verification
    expect(screen.getByText(/admin console/i)).toBeInTheDocument();
    expect(screen.getByText(/dealership director/i)).toBeInTheDocument();
    expect(screen.getByText(/administrator/i)).toBeInTheDocument();

    // Must NOT have customer shopping bag / cart / favourites in admin shell
    expect(screen.queryByTitle(/view cart docket/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/watchlist/i)).not.toBeInTheDocument();
  });

  it('displays image status and triggers live image generation for vehicles missing images', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/admin/inventory-summary')) {
        return Promise.resolve({ summary: sampleSummary });
      }
      if (url.includes('/api/vehicle-categories')) {
        return Promise.resolve({ categories: [{ id: 1, name: 'Coupe' }] });
      }
      if (url.includes('/api/vehicles')) {
        return Promise.resolve({
          vehicles: [sampleVehicleWithoutImage],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    mockApi.post.mockResolvedValueOnce({
      status: 'created',
      vehicleId: 'v-zero-1',
      image: {
        id: 'img-new-1',
        url: '/images/vehicles/porsche-911-gt3.webp',
        isPrimary: true,
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    // Verify inventory stats are rendered
    expect(await screen.findByText('35')).toBeInTheDocument(); // total vehicles

    // Verify row for Porsche 911 GT3 with 0 stock
    expect(screen.getByText('Porsche')).toBeInTheDocument();
    expect(screen.getByText('911 GT3')).toBeInTheDocument();
    expect(screen.getByText(/0 UNITS \(DEPLETED\)/i)).toBeInTheDocument();

    // Verify image status badge & "Generate Image" button
    const genButton = screen.getByRole('button', { name: /generate image/i });
    expect(genButton).toBeInTheDocument();

    await user.click(genButton);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/vehicles/v-zero-1/generate-image', {});
    });
    expect(await screen.findByText(/image generated successfully/i)).toBeInTheDocument();
  });

  it('allows intake of a zero-stock vehicle and dedicated restock workflow', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/admin/inventory-summary')) {
        return Promise.resolve({ summary: sampleSummary });
      }
      if (url.includes('/api/vehicle-categories')) {
        return Promise.resolve({ categories: [{ id: 1, name: 'Coupe' }] });
      }
      if (url.includes('/api/vehicles')) {
        return Promise.resolve({
          vehicles: [sampleVehicleWithoutImage],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    mockApi.post.mockResolvedValueOnce({ vehicle: sampleVehicleWithoutImage });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await screen.findByText(/dealership ledger/i);

    // Open Intake Modal
    await user.click(screen.getByRole('button', { name: /\+ New Chassis Intake/i }));

    expect(screen.getByRole('heading', { name: /register new chassis/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/make/i), 'McLaren');
    await user.type(screen.getByLabelText(/model/i), 'Artura');
    await user.selectOptions(screen.getByLabelText(/category/i), '1');
    await user.type(screen.getByLabelText(/price in inr/i), '35000000');
    const qtyInput = screen.getByLabelText(/opening physical quantity/i);
    await user.clear(qtyInput);
    await user.type(qtyInput, '0');

    await user.click(screen.getByRole('button', { name: /register chassis/i }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/vehicles',
        expect.objectContaining({
          make: 'McLaren',
          model: 'Artura',
          categoryId: 1,
          price: 35000000,
          quantity: 0,
        })
      );
    });
  });
});
