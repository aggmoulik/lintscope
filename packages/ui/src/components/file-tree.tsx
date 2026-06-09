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

/**
 * Folders to expand by default: only those that contain at least one subfolder.
 * Leaf folders (which directly hold files) stay collapsed, so the tree opens to
 * its directory structure without dumping every file — matching the design.
 */
function defaultExpandedFolders(node: FolderNode, out: string[] = []): string[] {
  for (const child of node.children) {
    if (child.kind === 'folder') {
      if (child.children.some((c) => c.kind === 'folder')) out.push(child.relativePath);
      defaultExpandedFolders(child, out);
    }
  }
  return out;
}

function byRelativePath(files: FileEntry[]): Map<string, FileEntry> {
  const m = new Map<string, FileEntry>();
  for (const f of files) m.set(f.relativePath, f);
  return m;
}

/**
 * A single severity dot on the right of every row — red if there are any nested
 * errors, amber if only warnings. The rolled-up counts stay in the DOM as
 * screen-reader-only text for accessibility.
 */
function SeverityDot({ errorCount, warningCount }: { errorCount: number; warningCount: number }) {
  if (errorCount === 0 && warningCount === 0) return null;
  const isError = errorCount > 0;
  return (
    <span className="flex items-center">
      <span
        data-severity={isError ? 'error' : 'warning'}
        aria-hidden
        className={cn('size-1.5 rounded-full', isError ? 'bg-error' : 'bg-warning')}
      />
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
        trailing={<SeverityDot errorCount={node.errorCount} warningCount={node.warningCount} />}
      >
        {renderNodes(node.children, selectedPath)}
      </Folder>
    ) : (
      <File
        key={`file:${node.relativePath}`}
        id={node.relativePath}
        label={node.name}
        data-relative-path={node.relativePath}
        trailing={<SeverityDot errorCount={node.errorCount} warningCount={node.warningCount} />}
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
  const defaultExpanded = useMemo(() => defaultExpandedFolders(root), [root]);
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
          'rounded-[9px] border border-line border-dashed p-6 text-sm text-ink-faint',
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
      className={cn('overflow-auto rounded-[9px] border border-line bg-surface p-2', className)}
    >
      {searchable && <FileTreeSearch placeholder="Filter files…" />}
      {renderNodes(root.children, selectedPath)}
    </FileTreeView>
  );
}
