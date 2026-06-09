import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * Warm editorial serif for display headings — pairs with Geist (sans/mono) for
 * body + code. Self-hosted at build time by next/font (no runtime Google call),
 * so the privacy posture holds. Italic is used for accented hero words.
 */
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'lintscope — A polished UI for your linter',
  description:
    'Copy-paste React components and a CLI for browsing ESLint, Biome, and OXC output in a real UI.',
  metadataBase: new URL('https://lintscope.vercel.app'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable} ${display.variable}`}
    >
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
