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
import * as React from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

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
      <Icon
        name="search"
        size={14}
        className="-translate-y-1/2 absolute top-1/2 left-2 text-ink-faint"
      />
      <input
        ref={ref}
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          onValueChange?.(e.target.value);
        }}
        className={cn(
          'w-full rounded-md border border-line bg-transparent py-1 pl-7 pr-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-line',
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
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-[5px] text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          data-folder-id={id}
        >
          <Icon
            name="chevron"
            size={13}
            stroke={2}
            className={cn(
              'shrink-0 text-ink-faint opacity-60 transition-transform',
              isOpen && 'rotate-90',
            )}
          />
          <Icon name="folder" size={15} className="shrink-0 text-ink-faint" />
          <span className="truncate font-mono text-[12px]">{label}</span>
          {trailing != null && <span className="ml-auto flex items-center pl-2">{trailing}</span>}
        </Accordion.Trigger>
        <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down">
          <div className="ml-2.5 border-l border-line pl-2">
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
        'relative flex w-full items-center gap-1.5 rounded-md px-1.5 py-[5px] text-left text-[13px] transition-colors',
        selected
          ? 'bg-accent-soft text-ink before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-accent'
          : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...props}
    >
      {icon ?? (
        <>
          <span aria-hidden className="w-[13px] shrink-0" />
          <Icon
            name="file"
            size={14}
            className={cn('shrink-0', selected ? 'text-accent' : 'text-ink-faint')}
          />
        </>
      )}
      <span className="truncate">{label}</span>
      {trailing != null && <span className="ml-auto flex items-center pl-2">{trailing}</span>}
    </button>
  );
}
