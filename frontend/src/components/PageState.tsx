export function PageState({ loading, error, onRetry }: { loading?: boolean; error?: string | null; onRetry?: () => void }) {
  if (loading) return <p className="loading-state" aria-live="polite">Loading…</p>;
  if (error) return <div className="empty-state" role="alert"><h2>Something went off line</h2><p>{error}</p>{onRetry && <button className="button outline" onClick={onRetry}>Try again</button>}</div>;
  return null;
}
