'use client';

import type { Diagnostic } from '@lintscope/schema';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { cn } from '../lib/utils';
import { DiagnosticCard } from './diagnostic-card';

export interface DiagnosticListProps {
  diagnostics: Diagnostic[];
  className?: string;
  /** Approximate row height in px. Defaults to 112 (card height + gap). */
  estimateSize?: number;
  /** Container height. The list is virtualized inside this scrolling area. */
  height?: number | string;
  onSelect?: (diagnostic: Diagnostic) => void;
  emptyState?: React.ReactNode;
}

export function DiagnosticList({
  diagnostics,
  className,
  estimateSize = 112,
  height = 600,
  onSelect,
  emptyState,
}: DiagnosticListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: diagnostics.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 6,
    getItemKey: (index) => diagnostics[index]?.id ?? index,
  });

  if (diagnostics.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-zinc-200 p-12 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500',
          className,
        )}
        style={typeof height === 'number' ? { height } : { height }}
      >
        {emptyState ?? 'No diagnostics. 🎉'}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto rounded-lg', className)}
      style={typeof height === 'number' ? { height } : { height }}
      data-testid="diagnostic-list-scroll"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const diagnostic = diagnostics[row.index];
          if (!diagnostic) return null;
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`,
                paddingBottom: 8,
              }}
            >
              <DiagnosticCard diagnostic={diagnostic} onClick={onSelect} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
