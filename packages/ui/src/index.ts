export { AutofixHint, type AutofixHintProps } from './components/autofix-hint';
export { CodePreview, type CodePreviewProps } from './components/code-preview';
export {
  CommandPalette,
  type CommandPaletteAction,
  type CommandPaletteProps,
  isCommandPaletteAction,
  summarizeForPalette,
} from './components/command-palette';
export { DiagnosticCard, type DiagnosticCardProps } from './components/diagnostic-card';
export { DiagnosticList, type DiagnosticListProps } from './components/diagnostic-list';
export {
  type BuiltDiff,
  buildDiff,
  DiffPreview,
  type DiffPreviewProps,
  type DiffRow,
  type DiffRowKind,
} from './components/diff-preview';
export {
  computeDiff,
  DiffViewer,
  DiffViewerContent,
  DiffViewerFile,
  DiffViewerFileBadge,
  DiffViewerHeader,
  DiffViewerLine,
  type DiffViewerProps,
  DiffViewerSplitLine,
  DiffViewerStats,
  diffLineTextVariants,
  diffLineVariants,
  diffViewerVariants,
  type ParsedFile,
  type ParsedLine,
  parsePatch,
  type SplitLinePair,
} from './components/diff-viewer';
export { FileTree, type FileTreeProps } from './components/file-tree';
export {
  File,
  type FileProps,
  FileTreeSearch,
  type FileTreeSearchProps,
  FileTreeView,
  type FileTreeViewProps,
  Folder,
  type FolderProps,
} from './components/file-tree-view';
export { LintDashboard, type LintDashboardProps } from './components/lint-dashboard';
export {
  LinterBadge,
  type LinterBadgeProps,
  type LinterBadgeTone,
} from './components/linter-badge';
export {
  RuleSummary,
  type RuleSummaryProps,
  summarizeByRule,
} from './components/rule-summary';
export { SeverityBadge, type SeverityBadgeProps } from './components/severity-badge';
export { applyEslintFix, type EslintFix } from './lib/apply-fix';
export {
  applyFilters,
  type DashboardFilters,
  EMPTY_FILTERS,
  hasActiveFilters,
} from './lib/filters';
export { cn } from './lib/utils';
