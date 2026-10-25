import { useState, useEffect } from 'react';
import { assetUrl } from '../api/urls';

export interface VehicleImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  loading?: 'lazy' | 'eager';
  showBadge?: boolean;
  lotId?: string;
}

export function NeutralVehicleSilhouette({ alt }: { alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      className="w-full h-full min-h-[160px] bg-paper-surface flex flex-col items-center justify-center p-4 relative overflow-hidden select-none"
    >
      <svg
        className="w-full max-w-[280px] h-auto text-ink-solid"
        viewBox="0 0 800 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="800" height="520" fill="#E8E1D4" rx="16" />
        {/* Car Outline Blueprint */}
        <path
          d="M135 324h530l-35-102-96-62H295l-101 62-59 102Z"
          stroke="#16150F"
          strokeWidth="12"
          strokeLinejoin="round"
        />
        <path
          d="m255 222 66-43h194l68 43H255Z"
          fill="#F2EDE4"
          stroke="#16150F"
          strokeWidth="10"
        />
        {/* Wheels */}
        <circle cx="250" cy="330" r="52" fill="#F2EDE4" stroke="#16150F" strokeWidth="12" />
        <circle cx="250" cy="330" r="22" fill="#16150F" />
        <circle cx="560" cy="330" r="52" fill="#F2EDE4" stroke="#16150F" strokeWidth="12" />
        <circle cx="560" cy="330" r="22" fill="#16150F" />
        {/* Accent Ground Line */}
        <path d="M120 405h560" stroke="#2F4BFF" strokeWidth="10" strokeLinecap="round" />
        <text
          x="400"
          y="462"
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="22"
          fontWeight="bold"
          fill="#16150F"
          letterSpacing="4"
        >
          ARCHIVE SPECIMEN
        </text>
      </svg>
      <span className="sr-only">{alt}</span>
    </div>
  );
}

export function VehicleImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'relative w-full overflow-hidden bg-paper-surface',
  aspectRatio = 'aspect-[16/10]',
  loading = 'lazy',
  showBadge = false,
  lotId,
}: VehicleImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset error & loaded state when image src changes
  useEffect(() => {
    setHasError(!src);
    setIsLoaded(false);
  }, [src]);

  const resolvedUrl = src ? assetUrl(src) : null;

  return (
    <div className={`${containerClassName} ${aspectRatio}`}>
      {/* If no src or error occurred, display neutral automotive silhouette */}
      {hasError || !resolvedUrl ? (
        <NeutralVehicleSilhouette alt={alt} />
      ) : (
        <>
          {/* Subtle loading placeholder skeleton */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-paper-recessed animate-pulse flex items-center justify-center">
              <span className="material-symbols-outlined text-ink-subtle text-3xl">directions_car</span>
            </div>
          )}
          <img
            src={resolvedUrl}
            alt={alt}
            loading={loading}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`${className} transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
      )}

      {/* Optional Lot Identifier Tag */}
      {showBadge && lotId && (
        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-ink-solid/90 text-paper-base font-data-mono text-stamp-badge shadow-[0_1px_0_#16150F] backdrop-blur-xs select-none">
          LOT #{lotId.slice(0, 8).toUpperCase()}
        </div>
      )}
    </div>
  );
}
