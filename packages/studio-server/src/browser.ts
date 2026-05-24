/**
 * Cross-platform browser-open. Delegates to the `open` package (which knows
 * how to find the user's default browser on macOS, Linux, and Windows).
 *
 * Failure is non-fatal — if we can't open the browser, the caller just needs
 * to copy the URL from stdout themselves. We log to stderr but never throw.
 */

export interface OpenBrowserOptions {
  /** If false (e.g. in CI or non-interactive scripts), don't attempt to open. */
  enabled?: boolean;
  /** Override the logger. Defaults to `console.error`. */
  log?: (message: string) => void;
}

export async function openBrowser(url: string, options: OpenBrowserOptions = {}): Promise<void> {
  if (options.enabled === false) return;
  // CI envs we should detect by default
  if (process.env.CI === 'true' || process.env.LINTSCOPE_NO_OPEN === '1') {
    return;
  }

  try {
    const mod = (await import('open')) as { default: (target: string) => Promise<unknown> };
    await mod.default(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (options.log ?? ((m: string) => console.error(m)))(
      `studio-server: could not open browser automatically (${message}). Open this URL manually: ${url}`,
    );
  }
}
