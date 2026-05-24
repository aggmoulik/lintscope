import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'lintscope — A polished UI for your linter',
  description:
    'Copy-paste React components and a CLI for browsing ESLint, Biome, and OXC output in a real UI.',
  metadataBase: new URL('https://lintscope.dev'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
