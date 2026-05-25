import type { LintReport } from '@lintscope/schema';
import { useMemo, useState } from 'react';
import { cn } from '../lib/utils';

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

export interface FileTreeProps {
  /** The files array from a LintReport. Counts are taken as-is, not recomputed. */
  files: FileEntry[];
  /** Currently-selected file's relativePath. Highlighted in the tree. */
  selectedPath?: string;
  /** Fired when the user clicks a file. */
  onSelect?: (file: FileEntry) => void;
  className?: string;
  /** Override the empty-state message. */
  emptyState?: React.ReactNode;
}

export function FileTree({ files, selectedPath, onSelect, className, emptyState }: FileTreeProps) {
  const root = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => allFolderPaths(root));

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

  const toggle = (folderPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  return (
    <nav
      aria-label="Files"
      className={cn(
        'overflow-auto rounded-lg border border-zinc-200 bg-white p-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950',
        className,
      )}
      data-testid="file-tree"
    >
      <TreeChildren
        nodes={root.children}
        depth={0}
        expanded={expanded}
        onToggle={toggle}
        selectedPath={selectedPath}
        onSelect={onSelect}
        filesByPath={byRelativePath(files)}
      />
    </nav>
  );
}

function byRelativePath(files: FileEntry[]): Map<string, FileEntry> {
  const m = new Map<string, FileEntry>();
  for (const f of files) m.set(f.relativePath, f);
  return m;
}

interface TreeChildrenProps {
  nodes: Array<FolderNode | FileNode>;
  depth: number;
  expanded: Set<string>;
  onToggle: (folderPath: string) => void;
  selectedPath: string | undefined;
  onSelect: ((file: FileEntry) => void) | undefined;
  filesByPath: Map<string, FileEntry>;
}

function TreeChildren(props: TreeChildrenProps) {
  return (
    <ul className="flex flex-col">
      {props.nodes.map((child) =>
        child.kind === 'folder' ? (
          <FolderRow key={`folder:${child.relativePath}`} folder={child} {...props} />
        ) : (
          <FileRow key={`file:${child.relativePath}`} file={child} {...props} />
        ),
      )}
    </ul>
  );
}

function FolderRow({
  folder,
  depth,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
  filesByPath,
}: { folder: FolderNode } & TreeChildrenProps) {
  const isOpen = expanded.has(folder.relativePath);
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(folder.relativePath)}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        data-depth={depth}
        aria-expanded={isOpen}
      >
        <span aria-hidden className="w-3 select-none text-zinc-400">
          {isOpen ? '▾' : '▸'}
        </span>
        <span className="truncate">{folder.name}</span>
        <span className="ml-auto flex items-center gap-1.5 pl-2 text-[10px] text-zinc-500 dark:text-zinc-500">
          {folder.errorCount > 0 && (
            <span className="text-red-600 dark:text-red-400">{folder.errorCount}</span>
          )}
          {folder.warningCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">{folder.warningCount}</span>
          )}
        </span>
      </button>
      {isOpen && (
        <TreeChildren
          nodes={folder.children}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
          filesByPath={filesByPath}
        />
      )}
    </li>
  );
}

function FileRow({
  file,
  depth,
  selectedPath,
  onSelect,
  filesByPath,
}: { file: FileNode } & TreeChildrenProps) {
  const entry = filesByPath.get(file.relativePath);
  const selected = selectedPath === file.relativePath;
  return (
    <li>
      <button
        type="button"
        onClick={() => entry && onSelect?.(entry)}
        className={cn(
          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900',
          selected
            ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100'
            : 'text-zinc-800 dark:text-zinc-200',
        )}
        style={{ paddingLeft: `${depth * 12 + 16}px` }}
        data-relative-path={file.relativePath}
        aria-current={selected ? 'true' : undefined}
      >
        <span className="truncate">{file.name}</span>
        <span
          className={cn(
            'ml-auto flex items-center gap-1.5 pl-2 text-[10px]',
            selected ? 'text-current' : 'text-zinc-500 dark:text-zinc-500',
          )}
        >
          {file.errorCount > 0 && (
            <span className={selected ? '' : 'text-red-600 dark:text-red-400'}>
              {file.errorCount}
            </span>
          )}
          {file.warningCount > 0 && (
            <span className={selected ? '' : 'text-amber-600 dark:text-amber-400'}>
              {file.warningCount}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
