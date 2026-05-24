import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ name: string }>;
}

const COMPONENT_MAP: Record<
  string,
  { file: string; registryDependencies: string[]; dependencies: string[] }
> = {
  'severity-badge': {
    file: 'severity-badge.tsx',
    registryDependencies: [],
    dependencies: ['class-variance-authority', 'clsx', 'tailwind-merge', '@lintscope/schema'],
  },
  'diagnostic-card': {
    file: 'diagnostic-card.tsx',
    registryDependencies: ['severity-badge'],
    dependencies: ['clsx', 'tailwind-merge', '@lintscope/schema'],
  },
  'diagnostic-list': {
    file: 'diagnostic-list.tsx',
    registryDependencies: ['diagnostic-card'],
    dependencies: ['@tanstack/react-virtual', 'clsx', 'tailwind-merge', '@lintscope/schema'],
  },
  'lint-dashboard': {
    file: 'lint-dashboard.tsx',
    registryDependencies: ['diagnostic-list'],
    dependencies: ['clsx', 'tailwind-merge', '@lintscope/schema'],
  },
};

const PACKAGES_UI_DIR = path.resolve(process.cwd(), '../../packages/ui/src/components');

export async function GET(_req: Request, ctx: RouteParams): Promise<NextResponse> {
  const { name } = await ctx.params;
  const meta = COMPONENT_MAP[name];
  if (!meta) {
    return NextResponse.json({ error: `Unknown component: ${name}` }, { status: 404 });
  }
  const filePath = path.join(PACKAGES_UI_DIR, meta.file);
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return NextResponse.json({ error: `Source file missing: ${meta.file}` }, { status: 500 });
  }

  const item = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name,
    type: 'registry:component',
    registryDependencies: meta.registryDependencies,
    dependencies: meta.dependencies,
    files: [
      {
        path: `components/${meta.file}`,
        content,
        type: 'registry:component',
      },
    ],
  };

  return NextResponse.json(item, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
