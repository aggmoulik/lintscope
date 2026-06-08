'use client';

import type { LintReport } from '@lintscope/schema';
import { useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';
import { File, FileTreeSearch, FileTreeView, Folder } from './file-tree-view';

type FileEntry = LintReport['files'][number];

interface FileNode {
  kind: 'file';
  name: string;
  /** Full relative path — used as the React key and as the selectedPath identity. */
  relativePath: string;
  errorCount: number;
  warningCount: number;
}

interface FolderNode {
  kind: 'folder';
  name: string;
  /** Empty string for the synthetic root. */
  relativePath: string;
  children: Array<FolderNode | FileNode>;
  errorCount: number;
  warningCount: number;
}

/**
 * Build a nested tree from a flat list of files. Path separator is `/` or `\`
 * (Windows) — the resulting `relativePath` on each node is normalized to `/`.
 */
function buildTree(files: FileEntry[]): FolderNode {
  const root: FolderNode = {
    kind: 'folder',
    name: '',
    relativePath: '',
    children: [],
    errorCount: 0,
    warningCount: 0,
  };

  for (const file of files) {
    const segments = file.relativePath.split(/[\\/]/).filter(Boolean);
    let current = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i] as string;
      const folderPath = segments.slice(0, i + 1).join('/');
      let next = current.children.find(
        (c): c is FolderNode => c.kind === 'folder' && c.name === segment,
      );
      if (!next) {
        next = {
          kind: 'folder',
          name: segment,
          relativePath: folderPath,
          children: [],
          errorCount: 0,
          warningCount: 0,
        };
        current.children.push(next);
      }
      current = next;
    }
    const leafName = segments[segments.length - 1] ?? file.relativePath;
    current.children.push({
      kind: 'file',
      name: leafName,
      relativePath: segments.join('/'),
      errorCount: file.errorCount,
      warningCount: file.warningCount,
    });
  }

  rollupCounts(root);
  sortInPlace(root);
  return root;
}

/** Bubble error/warning counts up from leaves so folder counts are accurate. */
function rollupCounts(node: FolderNode): void {
  for (const child of node.children) {
    if (child.kind === 'folder') rollupCounts(child);
    node.errorCount += child.errorCount;
    node.warningCount += child.warningCount;
  }
}

/** Folders before files; alphabetical within each kind. */
function sortInPlace(node: FolderNode): void {
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.kind === 'folder') sortInPlace(child);
  }
}

/** Collect all folder relativePaths so we can default-expand the whole tree. */
function allFolderPaths(node: FolderNode, out: Set<string> = new Set()): Set<string> {
  for (const child of node.children) {
    if (child.kind === 'folder') {
      out.add(child.relativePath);
      allFolderPaths(child, out);
    }
  }
  return out;
}

function byRelativePath(files: FileEntry[]): Map<string, FileEntry> {
  const m = new Map<string, FileEntry>();
  for (const f of files) m.set(f.relativePath, f);
  return m;
}

/** File rows show the actual issue/warning counts. */
function CountBadges({
  errorCount,
  warningCount,
  selected,
}: {
  errorCount: number;
  warningCount: number;
  selected?: boolean;
}) {
  if (errorCount === 0 && warningCount === 0) return null;
  return (
    <span className="flex items-center gap-1.5 text-[10px] tabular-nums">
      {errorCount > 0 && (
        <span className={selected ? 'text-current' : 'text-red-600 dark:text-red-400'}>
          {errorCount}
        </span>
      )}
      {warningCount > 0 && (
        <span className={selected ? 'text-current' : 'text-amber-600 dark:text-amber-400'}>
          {warningCount}
        </span>
      )}
    </span>
  );
}

/**
 * Folder rows show only color dots — red if any nested errors, amber if any
 * nested warnings — to keep deep paths readable. The rolled-up counts stay in
 * the DOM as screen-reader-only text for accessibility.
 */
function FolderIndicator({
  errorCount,
  warningCount,
}: {
  errorCount: number;
  warningCount: number;
}) {
  if (errorCount === 0 && warningCount === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {errorCount > 0 && (
        <span
          data-severity="error"
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400"
        />
      )}
      {warningCount > 0 && (
        <span
          data-severity="warning"
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400"
        />
      )}
      <span className="sr-only">
        {errorCount} errors, {warningCount} warnings
      </span>
    </span>
  );
}

function renderNodes(
  nodes: Array<FolderNode | FileNode>,
  selectedPath: string | undefined,
): React.ReactNode {
  return nodes.map((node) =>
    node.kind === 'folder' ? (
      <Folder
        key={`folder:${node.relativePath}`}
        id={node.relativePath}
        label={node.name}
        trailing={<FolderIndicator errorCount={node.errorCount} warningCount={node.warningCount} />}
      >
        {renderNodes(node.children, selectedPath)}
      </Folder>
    ) : (
      <File
        key={`file:${node.relativePath}`}
        id={node.relativePath}
        label={node.name}
        data-relative-path={node.relativePath}
        trailing={
          <CountBadges
            errorCount={node.errorCount}
            warningCount={node.warningCount}
            selected={selectedPath === node.relativePath}
          />
        }
      />
    ),
  );
}

export interface FileTreeProps {
  /** The files array from a LintReport. Counts are taken as-is, not recomputed. */
  files: FileEntry[];
  /** Currently-selected file's relativePath. Highlighted in the tree. */
  selectedPath?: string;
  /** Fired when the user clicks a file. */
  onSelect?: (file: FileEntry) => void;
  /** Show the filter input above the tree. Defaults to true. */
  searchable?: boolean;
  className?: string;
  /** Override the empty-state message. */
  emptyState?: React.ReactNode;
}

export function FileTree({
  files,
  selectedPath,
  onSelect,
  searchable = true,
  className,
  emptyState,
}: FileTreeProps) {
  const root = useMemo(() => buildTree(files), [files]);
  const defaultExpanded = useMemo(() => [...allFolderPaths(root)], [root]);
  const filesByPath = useMemo(() => byRelativePath(files), [files]);

  const handleSelect = useCallback(
    (id: string) => {
      const entry = filesByPath.get(id);
      if (entry) onSelect?.(entry);
    },
    [filesByPath, onSelect],
  );

  if (files.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500',
          className,
        )}
      >
        {emptyState ?? 'No files yet.'}
      </div>
    );
  }

  return (
    <FileTreeView
      aria-label="Files"
      data-testid="file-tree"
      defaultExpanded={defaultExpanded}
      selectedId={selectedPath ?? null}
      onSelect={handleSelect}
      className={cn(
        'overflow-auto rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
    >
      {searchable && <FileTreeSearch placeholder="Filter files…" />}
      {renderNodes(root.children, selectedPath)}
    </FileTreeView>
  );
}
