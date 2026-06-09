/**
 * The hosted studio UI the CLI opens, plus the CORS allow-origin derived from
 * it. Shared by every command that spins up a studio server (`studio`, `view`).
 *
 * The studio page makes cross-origin calls back to the local CLI server, and the
 * server's CORS allow-list is derived from THIS origin. So the CLI must open the
 * studio's *final* origin directly — a domain-level redirect (old → new) would
 * change the page's Origin and the handshake would be rejected.
 *
 * TODO: swap to https://lintscope.dev/studio once that custom domain is attached.
 */
export const DEFAULT_HOSTED_UI = 'https://lintscope.vercel.app/studio';

export interface HostedUiOptions {
  /**
   * Hosted UI URL. Precedence: `hostedUi` → `LINTSCOPE_HOSTED_UI` env →
   * `DEFAULT_HOSTED_UI`.
   */
  hostedUi?: string;
  /**
   * CORS allow-origin. Precedence: `allowOrigin` → `LINTSCOPE_ALLOW_ORIGIN`
   * env → the resolved `hostedUi` URL's own origin.
   */
  allowOrigin?: string;
}

/** Resolve the hosted-UI URL + CORS allow-origin for a studio session. */
export function resolveHostedUi(options: HostedUiOptions = {}): {
  hostedUi: string;
  allowOrigin: string;
} {
  const hostedUi = options.hostedUi ?? process.env.LINTSCOPE_HOSTED_UI ?? DEFAULT_HOSTED_UI;
  const allowOrigin =
    options.allowOrigin ?? process.env.LINTSCOPE_ALLOW_ORIGIN ?? new URL(hostedUi).origin;
  return { hostedUi, allowOrigin };
}
