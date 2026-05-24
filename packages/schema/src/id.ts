/**
 * Stable hash used as `Diagnostic.id`. Determined entirely by
 * (relativePath, line, column, ruleId, message) so the UI can dedupe
 * across re-runs and match diagnostics to a previous report.
 *
 * Implementation: FNV-1a 64-bit (split into two 32-bit lanes to stay in
 * safe-integer range). Non-cryptographic, but collision-resistant enough
 * for in-report uniqueness; the inputs already encode position + rule
 * which makes accidental collisions extremely unlikely.
 *
 * This file is browser-safe — no `node:` imports — so the same function
 * can recompute IDs on the consumer side if needed.
 */

const FNV_OFFSET_LO = 0x84_22_6325; // low 32 bits of 0xcbf29ce484222325
const FNV_OFFSET_HI = 0xcbf2_9ce4; // high 32 bits
const FNV_PRIME_LO = 0x0000_01b3;
const FNV_PRIME_HI = 0x0000_0100;

function fnv1a64Hex(input: string): string {
  let lo = FNV_OFFSET_LO >>> 0;
  let hi = FNV_OFFSET_HI >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    lo = (lo ^ c) >>> 0;
    // 64-bit multiply by FNV prime, split into 32-bit halves
    const loProduct = lo * FNV_PRIME_LO;
    const hiProduct = lo * FNV_PRIME_HI + hi * FNV_PRIME_LO;
    lo = loProduct >>> 0;
    hi = (hiProduct + ((loProduct / 0x1_0000_0000) | 0)) >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

export function diagnosticId(parts: {
  relativePath: string;
  line: number;
  column: number;
  ruleId: string | null;
  message: string;
}): string {
  const payload = [
    parts.relativePath,
    String(parts.line),
    String(parts.column),
    parts.ruleId ?? '',
    parts.message,
  ].join('\x1f');
  return fnv1a64Hex(payload);
}
