import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { VehicleCard } from './VehicleCard';
import type { Vehicle } from '../../types/api';

const vehicle: Vehicle = {
  id: 'vehicle-1', make: 'Honda', model: 'City', category: { id: 1, name: 'Sedan' },
  price: '1250000.00', quantity: 2, lowStockThreshold: 3, images: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

describe('VehicleCard', () => {
  it('uses real stock, INR formatting and a neutral fallback', () => {
    render(<MemoryRouter><VehicleCard vehicle={vehicle} onAddToCart={vi.fn()} onFavourite={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('₹12,50,000.00')).toBeInTheDocument();
    expect(screen.getByText(/low stock · 2 available/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /image unavailable for Honda City/i })).toBeInTheDocument();
  });

  it('folds only after the server confirms add-to-cart', async () => {
    let confirm!: () => void;
    const pending = new Promise<void>((resolve) => { confirm = resolve; });
    const add = vi.fn().mockReturnValue(pending);
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><VehicleCard vehicle={vehicle} onAddToCart={add} onFavourite={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(container.querySelector('.fold-success')).not.toBeInTheDocument();
    confirm();
    expect(await screen.findByText('Added to cart')).toBeInTheDocument();
    expect(container.querySelector('.fold-success')).toBeInTheDocument();
  });

  it('disables purchase actions when stock is zero', () => {
    render(<MemoryRouter><VehicleCard vehicle={{ ...vehicle, quantity: 0 }} onAddToCart={vi.fn()} onFavourite={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /purchase now/i })).toBeDisabled();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });
});
