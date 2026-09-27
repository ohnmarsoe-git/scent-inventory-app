import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
        Scent Syntax
      </p>
      <h1 className="mt-6 text-xl font-medium text-[var(--ink)]">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
        This app needs a connection for live inventory and sales. Reconnect, then
        try again.
      </p>
      <Link
        href="/"
        className="btn-primary mt-8"
      >
        Retry
      </Link>
    </div>
  );
}
