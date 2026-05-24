import { NextResponse } from 'next/server';

const REGISTRY = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'lintscope',
  homepage: 'https://lintscope.dev',
  items: [
    { name: 'severity-badge', type: 'registry:component' },
    { name: 'diagnostic-card', type: 'registry:component' },
    { name: 'diagnostic-list', type: 'registry:component' },
    { name: 'lint-dashboard', type: 'registry:component' },
  ],
};

export function GET(): NextResponse {
  return NextResponse.json(REGISTRY, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
