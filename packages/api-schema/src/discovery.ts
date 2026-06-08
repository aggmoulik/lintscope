/**
 * Local-server discovery contract shared by the CLI (which binds one of these
 * ports) and the hosted /studio page (which probes them). Keeping the range in
 * one place means the two sides can never drift.
 *
 * By default the CLI binds the first free port in this range and omits the port
 * from the studio URL; the page probes the range (calling `/handshake` on each)
 * to find the live server. An explicit `--port` falls outside the range, so the
 * CLI puts it back in the URL and the page uses it directly.
 */
export const STUDIO_PORT_BASE = 5174;
export const STUDIO_PORT_COUNT = 10;

/** `[5174, 5175, …, 5183]` — candidate ports, in probe/bind preference order. */
export const STUDIO_DISCOVERY_PORTS: readonly number[] = Array.from(
  { length: STUDIO_PORT_COUNT },
  (_, i) => STUDIO_PORT_BASE + i,
);
