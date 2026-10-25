export function PageState({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div
        className="loading-state p-12 text-center bg-paper-surface/80 border-[1.5px] border-dashed border-ink-solid rounded-2xl shadow-[0_2px_0_#16150F]"
        aria-live="polite"
      >
        <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-ink-solid border-t-action-blue animate-spin" />
        <p className="font-data-mono text-sm text-ink-muted font-bold tracking-wider uppercase">
          Loading…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="empty-state p-12 text-center bg-paper-surface border-[2px] border-alert-red rounded-2xl shadow-[0_4px_0_#16150F]"
        role="alert"
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#FFDAD6] border border-alert-red flex items-center justify-center text-alert-red font-bold">
          !
        </div>
        <h2 className="font-headline-md text-headline-md text-alert-red font-bold">
          Something went off line
        </h2>
        <p className="font-data-mono text-sm text-ink-muted mt-2 max-w-md mx-auto">{error}</p>
        {onRetry && (
          <button
            className="button outline mt-5 px-5 py-2 bg-paper-base hover:bg-paper-recessed text-ink-solid font-label-nav text-xs font-bold rounded-lg border border-ink-solid shadow-[0_2px_0_#16150F] transition-all"
            onClick={onRetry}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return null;
}
