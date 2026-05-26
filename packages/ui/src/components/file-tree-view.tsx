'use client';

/*
 * Compound file-tree primitives, adapted from the shadcn community component
 * at https://filetree.sachi.dev/r/file-tree.json. Changes from upstream:
 *   - `@/lib/utils` import rewritten to the package-relative path
 *   - shadcn semantic tokens (muted-foreground, border-input…) mapped to the
 *     project's zinc palette
 *   - rows are full-width with a `trailing` slot so callers can render badges
 *     (lintscope uses it for per-node error/warning counts)
 *   - controlled selection via `selectedId` + `onSelect` on the root
 *   - no `forceMount` on the accordion content, so collapsed subtrees unmount
 */

import * as Accordion from '@radix-ui/react-accordion';
import { FileIcon, FolderIcon, FolderOpenIcon, Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/utils';

type ItemInfo = { label: string; path: string[]; isFolder: boolean };

function computeVisibleIds(items: Map<string, ItemInfo>, query: string): Set<string> | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const visible = new Set<string>();
  const matchedFolders = new Set<string>();

  for (const [id, info] of items) {
    if (!info.label.toLowerCase().includes(q)) continue;
    visible.add(id);
    for (const a of info.path) visible.add(a);
    if (info.isFolder) matchedFolders.add(id);
  }

  for (const [id, info] of items) {
    if (info.path.some((a) => matchedFolders.has(a))) {
      visible.add(id);
      for (const a of info.path) visible.add(a);
    }
  }

  return visible;
}

interface FileTreeContextValue {
  selectedId: string | null;
  select: (id: string) => void;
  expandedIds: string[];
  setExpandedIds: (ids: string[]) => void;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  register: (id: string, info: ItemInfo) => void;
  visibleIds: Set<string> | null;
}

const FileTreeContext = React.createContext<FileTreeContextValue | null>(null);
const PathContext = React.createContext<string[]>([]);

function useFileTree(): FileTreeContextValue {
  const ctx = React.useContext(FileTreeContext);
  if (!ctx) throw new Error('FileTreeView primitives must be used within <FileTreeView>');
  return ctx;
}

export interface FileTreeViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Initially-expanded folder ids (uncontrolled). */
  defaultExpanded?: string[];
  /** Controlled expanded folder ids. */
  expanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Controlled selected item id. `null` means nothing selected. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function FileTreeView({
  className,
  children,
  defaultExpanded = [],
  expanded,
  onExpandedChange,
  selectedId,
  onSelect,
  ref,
  ...props
}: FileTreeViewProps) {
  const expandedControlled = expanded !== undefined;
  const [internalExpanded, setInternalExpanded] = React.useState<string[]>(defaultExpanded);
  const expandedIds = expandedControlled ? expanded : internalExpanded;

  const setExpandedIds = React.useCallback(
    (ids: string[]) => {
      if (!expandedControlled) setInternalExpanded(ids);
      onExpandedChange?.(ids);
    },
    [expandedControlled, onExpandedChange],
  );

  const selectionControlled = selectedId !== undefined;
  const [internalSelected, setInternalSelected] = React.useState<string | null>(null);
  const resolvedSelected = selectionControlled ? selectedId : internalSelected;

  const select = React.useCallback(
    (id: string) => {
      if (!selectionControlled) setInternalSelected(id);
      onSelect?.(id);
    },
    [selectionControlled, onSelect],
  );

  const [searchQuery, setSearchQuery] = React.useState('');
  const itemsRef = React.useRef<Map<string, ItemInfo>>(new Map());
  const [itemsVersion, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  const register = React.useCallback((id: string, info: ItemInfo) => {
    const existing = itemsRef.current.get(id);
    if (existing && existing.label === info.label && existing.isFolder === info.isFolder) return;
    itemsRef.current.set(id, info);
    forceUpdate();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemsVersion is a counter that intentionally re-runs the memo when items (re)register
  const visibleIds = React.useMemo(
    () => computeVisibleIds(itemsRef.current, searchQuery),
    [searchQuery, itemsVersion],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to search-driven visibility changes; depending on expandedIds would loop
  React.useEffect(() => {
    if (visibleIds && visibleIds.size > 0) {
      setExpandedIds([...new Set([...expandedIds, ...visibleIds])]);
    }
  }, [visibleIds]);

  const ctx = React.useMemo<FileTreeContextValue>(
    () => ({
      selectedId: resolvedSelected,
      select,
      expandedIds,
      setExpandedIds,
      searchQuery,
      setSearchQuery,
      register,
      visibleIds,
    }),
    [resolvedSelected, select, expandedIds, setExpandedIds, searchQuery, register, visibleIds],
  );

  return (
    <FileTreeContext.Provider value={ctx}>
      <div ref={ref} className={cn('select-none text-sm', className)} {...props}>
        <Accordion.Root
          type="multiple"
          value={expandedIds}
          onValueChange={setExpandedIds}
          className="flex flex-col"
        >
          {children}
        </Accordion.Root>
      </div>
    </FileTreeContext.Provider>
  );
}

export interface FileTreeSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  onValueChange?: (value: string) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function FileTreeSearch({ className, onValueChange, ref, ...props }: FileTreeSearchProps) {
  const { searchQuery, setSearchQuery } = useFileTree();
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        ref={ref}
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          onValueChange?.(e.target.value);
        }}
        className={cn(
          'w-full rounded-md border border-zinc-200 bg-transparent py-1 pl-7 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export interface FolderProps {
  id: string;
  label: string;
  /** Rendered right-aligned in the folder row (e.g. count badges). */
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function Folder({ className, id, label, trailing, children, ref }: FolderProps) {
  const { expandedIds, setExpandedIds, register, visibleIds } = useFileTree();
  const parentPath = React.useContext(PathContext);
  const path = React.useMemo(() => [...parentPath, id], [parentPath, id]);
  const isOpen = expandedIds.includes(id);

  React.useEffect(() => {
    register(id, { label, path: parentPath, isFolder: true });
  }, [id, label, parentPath, register]);

  if (visibleIds && !visibleIds.has(id)) return null;

  return (
    <PathContext.Provider value={path}>
      <Accordion.Item ref={ref} value={id} className={className}>
        <Accordion.Trigger
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          data-folder-id={id}
        >
          {isOpen ? (
            <FolderOpenIcon className="size-4 shrink-0 text-zinc-400" />
          ) : (
            <FolderIcon className="size-4 shrink-0 text-zinc-400" />
          )}
          <span className="truncate">{label}</span>
          {trailing != null && <span className="ml-auto flex items-center pl-2">{trailing}</span>}
        </Accordion.Trigger>
        <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down">
          <div className="ml-2.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
            <Accordion.Root
              type="multiple"
              value={expandedIds}
              onValueChange={setExpandedIds}
              className="flex flex-col"
            >
              {children}
            </Accordion.Root>
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </PathContext.Provider>
  );
}

export interface FileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  label: string;
  /** Rendered right-aligned in the file row (e.g. count badges). */
  trailing?: React.ReactNode;
  icon?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

export function File({ className, id, label, trailing, icon, ref, ...props }: FileProps) {
  const { selectedId, select, register, visibleIds } = useFileTree();
  const parentPath = React.useContext(PathContext);
  const selected = selectedId === id;

  React.useEffect(() => {
    register(id, { label, path: parentPath, isFolder: false });
  }, [id, label, parentPath, register]);

  if (visibleIds && !visibleIds.has(id)) return null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => select(id)}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors',
        selected
          ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
          : 'text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900',
        className,
      )}
      {...props}
    >
      {icon ?? (
        <FileIcon className={cn('size-4 shrink-0', selected ? 'text-current' : 'text-zinc-400')} />
      )}
      <span className="truncate">{label}</span>
      {trailing != null && <span className="ml-auto flex items-center pl-2">{trailing}</span>}
    </button>
  );
}
