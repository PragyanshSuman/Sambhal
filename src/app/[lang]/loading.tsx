export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-2/3 rounded-lg bg-surface-2" />
      <div className="h-4 w-1/2 rounded bg-surface-2" />
      <div className="h-64 rounded-2xl bg-surface-2" />
    </div>
  );
}
