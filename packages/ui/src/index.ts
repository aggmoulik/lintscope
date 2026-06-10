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
export { ICONS, Icon, type IconName, type IconProps } from './components/icon';
export { LintDashboard, type LintDashboardProps } from './components/lint-dashboard';
export { LinterBadge, type LinterBadgeProps } from './components/linter-badge';
export { LinterLogo, type LinterLogoProps } from './components/linter-logo';
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
export {
  deriveLinterMeta,
  type LinterTone,
  type ResolvedLinterMeta,
  resolveLinterMeta,
} from './lib/linter-meta';
export { cn } from './lib/utils';
