import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VehicleImage } from './VehicleImage';

describe('VehicleImage Component', () => {
  it('renders image with resolved asset URL and descriptive alt text', () => {
    render(
      <VehicleImage
        src="/images/vehicles/honda_city_2024.webp"
        alt="2024 Honda City, front three-quarter view"
      />
    );

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/vehicles/honda_city_2024.webp');
    expect(img).toHaveAttribute('alt', '2024 Honda City, front three-quarter view');
  });

  it('renders neutral silhouette when src is null or empty without trying to fetch broken image', () => {
    render(
      <VehicleImage
        src={null}
        alt="Image unavailable for Tata Nexon"
      />
    );

    expect(screen.queryByRole('img', { name: 'Image unavailable for Tata Nexon' })).toBeInTheDocument();
    expect(screen.getByText('ARCHIVE SPECIMEN')).toBeInTheDocument();
  });

  it('handles image error gracefully by falling back to neutral silhouette without infinite loops', () => {
    const { container } = render(
      <VehicleImage
        src="/images/vehicles/non_existent_car.webp"
        alt="Missing Car Model"
      />
    );

    const img = screen.getByRole('img');
    // Simulate browser failing to load image
    fireEvent.error(img);

    // After error, img should be replaced by neutral vector silhouette
    expect(screen.queryByRole('img', { name: 'Missing Car Model' })).toBeInTheDocument();
    expect(screen.getByText('ARCHIVE SPECIMEN')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull(); // No broken img tag remains to trigger loop
  });

  it('displays lot identification badge when requested', () => {
    render(
      <VehicleImage
        src="/images/vehicles/honda_city_2024.webp"
        alt="2024 Honda City"
        showBadge={true}
        lotId="a1b2c3d4-e5f6-7890"
      />
    );

    expect(screen.getByText('LOT #A1B2C3D4')).toBeInTheDocument();
  });

  it('renders image with frontend static origin even when VITE_API_BASE_URL is configured', () => {
    const originalApiBase = import.meta.env.VITE_API_BASE_URL;
    try {
      import.meta.env.VITE_API_BASE_URL = 'https://creaseline-backend.vercel.app';
      render(
        <VehicleImage
          src="/images/vehicles/honda_city_2024.webp"
          alt="Honda City Deployed"
        />
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/images/vehicles/honda_city_2024.webp');
      expect(img.getAttribute('src')).not.toContain('creaseline-backend.vercel.app');
    } finally {
      if (originalApiBase === undefined) {
        delete import.meta.env.VITE_API_BASE_URL;
      } else {
        import.meta.env.VITE_API_BASE_URL = originalApiBase;
      }
    }
  });
});
