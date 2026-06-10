'use client';

import type { Diagnostic } from '@lintscope/schema';
import { useEffect, useState } from 'react';
import { applyEslintFix } from '../lib/apply-fix';
import type { ResolvedLinterMeta } from '../lib/linter-meta';
import { cn } from '../lib/utils';
import { AutofixHint } from './autofix-hint';
import { CodePreview } from './code-preview';
import { DiffViewer } from './diff-viewer';
import { Icon } from './icon';
import { LinterLogo } from './linter-logo';
import { SeverityBadge } from './severity-badge';

export interface DiagnosticCardProps {
  diagnostic: Diagnostic;
  /**
   * Resolved display meta for this diagnostic's linter — from
   * `resolveLinterMeta(report)[diagnostic.source]` or `deriveLinterMeta(source)`.
   * Required: all per-linter branding/behavior flows through it.
   */
  meta: ResolvedLinterMeta;
  className?: string;
  onClick?: (diagnostic: Diagnostic) => void;
  /** When provided, renders a "Dismiss" action that hides the card from view. */
  onDismiss?: (id: string) => void;
  /**
   * Optional source fetcher. When provided, the card lazily fetches the file
   * source for the inline preview (green/red diff for ESLint autofixes, or a
   * highlighted code slice otherwise).
   */
  onFetchSource?: (relativePath: string) => Promise<string>;
}

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; source: string }
  | { kind: 'error'; message: string };

export function DiagnosticCard({
  diagnostic,
  meta,
  className,
  onClick,
  onDismiss,
  onFetchSource,
}: DiagnosticCardProps) {
  const hasFix = Boolean(diagnostic.fix);
  // Auto-fixable ONLY when the linter actually reports it: inline `fix` data
  // (range + replacement text) or an explicit `fixable` flag. Never guessed.
  const fixable = hasFix || diagnostic.fixable === true;
  const canPreview = Boolean(onFetchSource);
  // Inline diff preview whenever the diagnostic carries fix data — the
  // range/text shape is linter-agnostic, no source check needed.
  const previewIsAutofix = hasFix;
  // Otherwise, when the diagnostic is fixable and its linter declares a CLI
  // autofix command (via adapter meta), hand the user that command.
  const showFixCommand = fixable && !hasFix && meta.fixCommand !== null;
  const fileName = diagnostic.relativePath.split('/').pop() ?? diagnostic.relativePath;

  const [preview, setPreview] = useState<PreviewState>({ kind: 'idle' });
  const [showCode, setShowCode] = useState(true);

  useEffect(() => {
    if (!onFetchSource) {
      setPreview({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setPreview({ kind: 'loading' });
    onFetchSource(diagnostic.relativePath)
      .then((source) => {
        if (!cancelled) setPreview({ kind: 'ready', source });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPreview({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [diagnostic.relativePath, onFetchSource]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      data-diagnostic-id={diagnostic.id}
      data-severity={diagnostic.severity}
      onClick={onClick ? () => onClick(diagnostic) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(diagnostic);
              }
            }
          : undefined
      }
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface p-[18px] shadow-card transition-colors hover:border-line-strong',
        onClick &&
          'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          diagnostic.severity === 'error'
            ? 'bg-error'
            : diagnostic.severity === 'warning'
              ? 'bg-warning'
              : 'bg-violet',
        )}
      />
      <header className="flex flex-wrap items-center gap-2.5">
        <SeverityBadge severity={diagnostic.severity} />
        {diagnostic.ruleId ? (
          diagnostic.url ? (
            <a
              href={diagnostic.url}
              target="_blank"
              rel="noreferrer"
              onClick={stop}
              className="font-mono text-[13px] font-medium text-ink transition-colors hover:text-accent"
            >
              {diagnostic.ruleId}
            </a>
          ) : (
            <span className="font-mono text-[13px] font-medium text-ink">{diagnostic.ruleId}</span>
          )
        ) : (
          <span className="font-mono text-[13px] text-ink-faint italic">parser-error</span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
          <LinterLogo meta={meta} size={14} />
          {meta.label}
        </span>
        <div className="flex-1" />
        {fixable && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-[3px] text-[11.5px] font-medium text-ok ring-1 ring-ok/25 ring-inset">
            <Icon name="zap" size={11} stroke={2} className="text-ok" />
            Auto-fixable
          </span>
        )}
      </header>

      <p className="mt-3 mb-3.5 max-w-[70ch] text-[14.5px] leading-relaxed text-ink">
        {diagnostic.message}
      </p>

      {canPreview && showCode && (
        <div className="text-xs" data-testid="preview-panel">
          {preview.kind === 'loading' && <p className="text-ink-faint">Loading source…</p>}
          {preview.kind === 'error' && (
            <p className="text-error">Couldn't load source: {preview.message}</p>
          )}
          {preview.kind === 'ready' &&
            (previewIsAutofix && diagnostic.fix ? (
              <DiffViewer
                oldFile={{ content: preview.source, name: diagnostic.relativePath }}
                newFile={{
                  content: applyEslintFix(preview.source, diagnostic.fix),
                  name: diagnostic.relativePath,
                }}
                size="sm"
                showIcon={false}
              />
            ) : (
              <CodePreview
                source={preview.source}
                line={diagnostic.line}
                column={diagnostic.column}
                fileName={diagnostic.relativePath}
                {...(diagnostic.endLine !== undefined ? { endLine: diagnostic.endLine } : {})}
              />
            ))}
        </div>
      )}

      <footer className="mt-3.5 flex flex-wrap items-center gap-3 text-[12.5px] text-ink-muted">
        {canPreview && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setShowCode((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon
              name="chevron"
              size={13}
              stroke={2}
              style={{
                transform: showCode ? 'rotate(90deg)' : 'none',
                transition: 'transform .15s',
              }}
            />
            {showCode ? 'Hide code' : 'Show code'}
          </button>
        )}
        <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-ink-faint">
          <Icon name="file" size={12} />
          {fileName}
          <span className="text-accent">
            :{diagnostic.line}:{diagnostic.column}
          </span>
        </span>
        <div className="flex-1" />
        {showFixCommand && meta.fixCommand !== null && <AutofixHint command={meta.fixCommand} />}
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onDismiss(diagnostic.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="x" size={13} stroke={2} />
            Dismiss
          </button>
        )}
      </footer>
    </article>
  );
}
