export function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="space-y-2">
        <div className="h-8 w-44 rounded-sm bg-[var(--surface-2)]" />
        <div className="h-4 w-64 max-w-full rounded-sm bg-[var(--surface-2)]/80" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 border border-[var(--stroke)] bg-[var(--surface)]"
          />
        ))}
      </div>
      <div className="h-48 border border-[var(--stroke)] bg-[var(--surface)]" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-11 border border-[var(--stroke)] bg-[var(--surface)]"
            style={{ opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}
