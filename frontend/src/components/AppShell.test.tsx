import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import type { CartResponse } from '../types/api';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

const mockUser = vi.hoisted(() => ({
  id: 'shopper-1',
  fullName: 'Arjun Verma',
  email: 'arjun@example.com',
  role: 'user' as const,
  isVerified: true,
  isActive: true,
}));

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    api: mockApi,
    user: mockUser,
    logout: vi.fn(),
  }),
}));

const sampleCart: CartResponse = {
  cart: { id: 'cart-101' },
  items: [
    {
      vehicleId: 'v-1',
      label: 'Honda City V',
      price: '1310000.00',
      stock: 3,
      available: true,
    },
  ],
  itemCount: 1,
  subtotal: '1310000.00',
};

describe('AppShell: Compact Header, Cart Drawer & Interactive Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders compact header and excludes admin inventory controls for shoppers', async () => {
    mockApi.get.mockResolvedValue(sampleCart);

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );

    // Brand and customer links
    expect(screen.getByRole('link', { name: /creaseline/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /the floor/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /favourites/i })).toBeInTheDocument();

    // Shopper navigation must NOT have administrative inventory links
    expect(screen.queryByRole('link', { name: /inventory master/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /console/i })).not.toBeInTheDocument();
  });

  it('opens and closes the slide-over cart drawer with live line items and server subtotal', async () => {
    mockApi.get.mockResolvedValue(sampleCart);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );

    // Open Cart Drawer via the header cart button
    const cartButton = await screen.findByRole('button', { name: /view cart docket/i });
    await user.click(cartButton);

    // Drawer opens showing line items and subtotal
    expect(await screen.findByRole('heading', { name: /your cart/i })).toBeInTheDocument();
    expect(screen.getByText('Honda City V')).toBeInTheDocument();
    expect(screen.getAllByText('₹13,10,000.00')).toHaveLength(2);

    // Close button dismisses the drawer
    const closeBtn = screen.getByRole('button', { name: /close cart drawer/i });
    await user.click(closeBtn);

    await waitFor(() => {
      const drawer = screen.getByRole('complementary', { name: /cart drawer/i });
      expect(drawer).toHaveClass('translate-x-full');
    });
  });

  it('renders interactive footer with oversized brandmark and back-to-top control', async () => {
    mockApi.get.mockResolvedValue(sampleCart);
    window.scrollTo = vi.fn();

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );

    // Footer brandmark & CTA
    expect(screen.getByRole('link', { name: /browse the live floor/i })).toBeInTheDocument();
    expect(screen.getByText('CREASELINE MOTORWORKS ARCHIVE © 2026. ALL SPECIFICATION SHEETS BOUND IN INK.')).toBeInTheDocument();

    // Back to top button triggers smooth window scroll
    const topBtn = screen.getByRole('button', { name: /back to top/i });
    await user.click(topBtn);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
