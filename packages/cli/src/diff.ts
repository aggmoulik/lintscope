import type { Diagnostic } from '@lintscope/schema';

export interface DiagnosticDiff {
  /** Diagnostics present in the new report that weren't in the previous one. */
  added: Diagnostic[];
  /** IDs from the previous report that no longer exist. */
  removed: string[];
}

/**
 * Compute the diff between two diagnostic snapshots by stable id.
 *
 * `Diagnostic.id` is the FNV-1a hash of (relativePath, line, column, ruleId,
 * message), so an issue that simply moves down a line — same rule, same file
 * — gets a *new* id. That's intentional: the UI treats it as "removed, added"
 * rather than trying to follow it visually, which keeps the wire shape simple.
 */
export function diffDiagnostics(previous: Diagnostic[], next: Diagnostic[]): DiagnosticDiff {
  const previousIds = new Set(previous.map((d) => d.id));
  const nextIds = new Set(next.map((d) => d.id));

  const added: Diagnostic[] = [];
  for (const d of next) {
    if (!previousIds.has(d.id)) added.push(d);
  }

  const removed: string[] = [];
  for (const id of previousIds) {
    if (!nextIds.has(id)) removed.push(id);
  }

  return { added, removed };
}
