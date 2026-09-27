export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-4">
      <div className="h-8 w-48 bg-[var(--surface-2)]" />
      <div className="h-4 w-72 bg-[var(--surface-2)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 border border-[var(--stroke)] bg-[var(--surface)]" />
        ))}
      </div>
      <div className="h-40 border border-[var(--stroke)] bg-[var(--surface)]" />
    </div>
  );
}
