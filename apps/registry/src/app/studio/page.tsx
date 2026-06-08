import { Suspense } from 'react';
import { ConnectionPending } from './_components/connection-pending';
import { StudioClient } from './_components/studio-client';

export const metadata = {
  title: 'lintscope · studio',
  description: 'Browse your local lint diagnostics. Data stays on your machine.',
};

// Don't pre-render: this page reads URL params and talks to localhost.
export const dynamic = 'force-dynamic';

export default function StudioPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={<ConnectionPending />}>
        <StudioClient />
      </Suspense>
    </main>
  );
}
