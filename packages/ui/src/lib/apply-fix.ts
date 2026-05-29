/**
 * Shape of an ESLint autofix as captured in our normalized `Diagnostic.fix`
 * (`@lintscope/schema`). Re-declared structurally here so this helper can be
 * used standalone, without forcing a registry consumer to depend on the
 * lintscope schema package.
 */
export interface EslintFix {
  range: [number, number];
  text: string;
}

/**
 * Apply an ESLint-style autofix to a source string and return the patched
 * source. ESLint emits character offsets into the original JS string, so a
 * plain `slice(0, start) + text + slice(end)` round-trips correctly for
 * BMP-only sources and remains consistent with ESLint's own indexing for
 * sources that contain BMP characters outside ASCII.
 */
export function applyEslintFix(source: string, fix: EslintFix): string {
  const [start, end] = fix.range;
  return source.slice(0, start) + fix.text + source.slice(end);
}
