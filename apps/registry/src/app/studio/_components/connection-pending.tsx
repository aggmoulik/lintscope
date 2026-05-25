export function ConnectionPending() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-200 p-12 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
      <Spinner />
      <p>Connecting to your local studio…</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-zinc-400"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
