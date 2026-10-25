import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  user: { id: 'user-1', email: 'shopper@creaseline.in', fullName: 'Collector One', role: 'user' },
}));
vi.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ api: mocks.api, user: mocks.user }) }));

import { CataloguePage } from './CataloguePage';
import { CartPage } from './CartPage';
import { NotificationsPage } from './NotificationsPage';
import { HomePage } from './HomePage';

describe('connected workflow pages', () => {
  beforeEach(() => { for (const method of Object.values(mocks.api)) method.mockReset(); });

  it('synchronizes submitted catalogue filters and resets to page one', async () => {
    mocks.api.get.mockImplementation((path: string) => Promise.resolve(path === '/api/vehicle-categories'
      ? { categories: [{ id: 1, name: 'Sedan' }] }
      : { vehicles: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } }));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/vehicles?page=4']}><CataloguePage /></MemoryRouter>);
    await screen.findByText(/no vehicles match/i);
    await user.type(screen.getByLabelText('Search'), 'Honda');
    await user.selectOptions(screen.getByLabelText('Category'), '1');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith(expect.stringMatching(/search=Honda/)));
    expect(mocks.api.get).toHaveBeenCalledWith(expect.stringMatching(/categoryId=1/));
    expect(mocks.api.get).toHaveBeenCalledWith(expect.stringMatching(/page=1/));
  });

  it('shows server subtotal and refreshes a conflicted checkout', async () => {
    const cart = { cart: { id: 'cart-1' }, items: [{ vehicleId: 'v1', label: 'Honda City', price: '1250000.00', stock: 1, available: true }], itemCount: 1, subtotal: '1250000.00' };
    mocks.api.get.mockResolvedValue(cart);
    mocks.api.post.mockRejectedValue(new ApiError(409, 'Price changed for vehicle v1'));
    const user = userEvent.setup();
    render(<CartPage />);
    expect(await screen.findAllByText('₹12,50,000.00')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Confirm purchase' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cart has been refreshed/i);
    expect(mocks.api.get).toHaveBeenCalledTimes(2);
  });

  it('marks only one notification read and refreshes the unread count', async () => {
    const unread = { notifications: [{ id: 'n1', type: 'low_stock', message: 'Honda City is low on stock', vehicleId: 'v1', createdAt: '2026-01-01T00:00:00Z', readAt: null, read: false }], unreadCount: 1, pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } };
    const read = { ...unread, notifications: [{ ...unread.notifications[0], read: true, readAt: '2026-01-01T01:00:00Z' }], unreadCount: 0 };
    mocks.api.get.mockResolvedValueOnce(unread).mockResolvedValueOnce(read);
    mocks.api.patch.mockResolvedValue({ notification: read.notifications[0] });
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(screen.getByText('0 unread')).toBeInTheDocument());
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/notifications/n1/read', {});
  });

  it('renders bay-window interactive showcase rail on home page for featured vehicles', async () => {
    const featuredVehicles = [
      {
        id: 'v101',
        make: 'Porsche',
        model: '911 Carrera',
        category: { id: 1, name: 'Sports Coupe' },
        price: '18500000.00',
        quantity: 2,
        lowStockThreshold: 1,
        images: [{ id: 'img-1', url: '/images/porsche.webp', altText: 'Porsche 911', displayOrder: 0 }],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    mocks.api.get.mockImplementation((path: string) => {
      if (path.includes('/api/vehicles')) {
        return Promise.resolve({ vehicles: featuredVehicles, pagination: { total: 35, page: 1, limit: 6, totalPages: 6 } });
      }
      return Promise.resolve({ categories: [{ id: 1, name: 'Sports Coupe' }] });
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/bay-window exposé/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inspect porsche 911 carrera/i })).toBeInTheDocument();
  });
});
