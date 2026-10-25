import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../App';

describe('authentication flow', () => {
  it('validates registration before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>);
    await user.type(screen.getByLabelText(/full name/i), 'Asha Rao');
    await user.type(screen.getByLabelText(/email/i), 'asha@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('redirects protected catalogue routes to sign in', async () => {
    render(<MemoryRouter initialEntries={['/vehicles']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to browse live inventory/i)).toBeInTheDocument();
  });

  it('signs in and opens the real catalogue', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: 'token',
        user: { id: 'u1', fullName: 'Asha Rao', email: 'asha@example.com', role: 'user', isVerified: false, isActive: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        vehicles: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ categories: [] }), { status: 200 }));

    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/sign-in']}><App /></MemoryRouter>);
    await user.type(screen.getByLabelText(/email/i), 'asha@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('heading', { name: /the floor/i })).toBeInTheDocument();
    expect(await screen.findByText(/no vehicles match/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(sessionStorage.getItem('creaseline.session')).toBe('token');
    fetchMock.mockRestore();
  });

  it('rejects regular account on admin sign-in option and prevents session storage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: 'user-token',
        user: { id: 'u1', fullName: 'Normal Buyer', email: 'buyer@example.com', role: 'user', isVerified: false, isActive: true },
      }), { status: 200 }));

    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/sign-in']}><App /></MemoryRouter>);

    // Click Admin Console tab / toggle
    const adminTab = screen.getByRole('button', { name: /admin console/i });
    await user.click(adminTab);

    expect(screen.getByRole('heading', { name: /admin terminal access/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/admin email/i), 'buyer@example.com');
    await user.type(screen.getByLabelText(/passcode/i), 'password123');
    await user.click(screen.getByRole('button', { name: /authenticate as admin/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/This account does not have administrator access/i);
    expect(sessionStorage.getItem('creaseline.session')).toBeNull();
    fetchMock.mockRestore();
  });

  it('authenticates admin user via admin sign-in option and navigates to admin workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: 'admin-token',
        user: { id: 'a1', fullName: 'Dealership Director', email: 'admin@creaseline.com', role: 'admin', isVerified: true, isActive: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        totalVehicles: 35,
        totalQuantity: 27,
        lowStockCount: 3,
        outOfStockCount: 5,
        totalValue: '119100000.00',
        activeListings: 35,
        inactiveListings: 0,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        vehicles: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      }), { status: 200 }));

    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/sign-in']}><App /></MemoryRouter>);

    const adminTab = screen.getByRole('button', { name: /admin console/i });
    await user.click(adminTab);

    await user.type(screen.getByLabelText(/admin email/i), 'admin@creaseline.com');
    await user.type(screen.getByLabelText(/passcode/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /authenticate as admin/i }));

    expect(await screen.findByRole('heading', { name: /dealership ledger/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('creaseline.session')).toBe('admin-token');
    fetchMock.mockRestore();
  });
});
