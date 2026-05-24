import { describe, expect, it } from 'vitest';
import {
  DiagnosticsDeltaEventSchema,
  HeartbeatEventSchema,
  ReportUpdatedEventSchema,
  ServerShutdownEventSchema,
  SSE_EVENT_NAMES,
  SseEventSchema,
} from '../src/events';

describe('SSE_EVENT_NAMES', () => {
  it('maps friendly keys to wire names', () => {
    expect(SSE_EVENT_NAMES).toEqual({
      reportUpdated: 'report.updated',
      diagnosticsDelta: 'diagnostics.delta',
      serverShutdown: 'server.shutdown',
      heartbeat: 'heartbeat',
    });
  });

  it('wire names match the `type` literal of each event schema', () => {
    // Cross-check that we don't drift between the discriminator and the wire name.
    expect(SSE_EVENT_NAMES.reportUpdated).toBe(
      ReportUpdatedEventSchema.parse({
        type: 'report.updated',
        generatedAt: '2026-05-25T10:00:00.000Z',
      }).type,
    );
    expect(SSE_EVENT_NAMES.diagnosticsDelta).toBe(
      DiagnosticsDeltaEventSchema.parse({
        type: 'diagnostics.delta',
        added: [],
        removed: [],
      }).type,
    );
    expect(SSE_EVENT_NAMES.serverShutdown).toBe(
      ServerShutdownEventSchema.parse({ type: 'server.shutdown' }).type,
    );
    expect(SSE_EVENT_NAMES.heartbeat).toBe(
      HeartbeatEventSchema.parse({ type: 'heartbeat', uptimeMs: 0 }).type,
    );
  });
});

describe('ReportUpdatedEventSchema', () => {
  it('accepts a well-formed event', () => {
    expect(() =>
      ReportUpdatedEventSchema.parse({
        type: 'report.updated',
        generatedAt: '2026-05-25T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects an invalid datetime', () => {
    expect(() =>
      ReportUpdatedEventSchema.parse({ type: 'report.updated', generatedAt: 'last tuesday' }),
    ).toThrow();
  });

  it('rejects wrong type literal', () => {
    expect(() =>
      ReportUpdatedEventSchema.parse({
        type: 'something.else',
        generatedAt: '2026-05-25T10:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('DiagnosticsDeltaEventSchema', () => {
  const validDiagnostic = {
    id: 'abc123',
    filePath: '/repo/src/foo.ts',
    relativePath: 'src/foo.ts',
    line: 12,
    column: 3,
    ruleId: 'no-console',
    severity: 'error' as const,
    message: 'Unexpected console.',
    source: 'eslint',
  };

  it('accepts a delta with both added + removed', () => {
    expect(() =>
      DiagnosticsDeltaEventSchema.parse({
        type: 'diagnostics.delta',
        added: [validDiagnostic],
        removed: ['old-id-1', 'old-id-2'],
      }),
    ).not.toThrow();
  });

  it('accepts empty arrays (no-op delta still legal)', () => {
    expect(() =>
      DiagnosticsDeltaEventSchema.parse({
        type: 'diagnostics.delta',
        added: [],
        removed: [],
      }),
    ).not.toThrow();
  });

  it('rejects malformed diagnostic in added[]', () => {
    expect(() =>
      DiagnosticsDeltaEventSchema.parse({
        type: 'diagnostics.delta',
        added: [{ ...validDiagnostic, line: 0 }],
        removed: [],
      }),
    ).toThrow();
  });

  it('rejects empty strings in removed[]', () => {
    expect(() =>
      DiagnosticsDeltaEventSchema.parse({
        type: 'diagnostics.delta',
        added: [],
        removed: [''],
      }),
    ).toThrow();
  });
});

describe('ServerShutdownEventSchema', () => {
  it('accepts the bare event with no reason', () => {
    expect(() => ServerShutdownEventSchema.parse({ type: 'server.shutdown' })).not.toThrow();
  });

  it('accepts the event with a reason string', () => {
    expect(() =>
      ServerShutdownEventSchema.parse({ type: 'server.shutdown', reason: 'SIGINT' }),
    ).not.toThrow();
  });
});

describe('HeartbeatEventSchema', () => {
  it('accepts a non-negative uptime', () => {
    expect(HeartbeatEventSchema.parse({ type: 'heartbeat', uptimeMs: 0 }).uptimeMs).toBe(0);
    expect(HeartbeatEventSchema.parse({ type: 'heartbeat', uptimeMs: 12345 }).uptimeMs).toBe(12345);
  });

  it('rejects negative uptime', () => {
    expect(() => HeartbeatEventSchema.parse({ type: 'heartbeat', uptimeMs: -1 })).toThrow();
  });

  it('rejects fractional uptime (must be int)', () => {
    expect(() => HeartbeatEventSchema.parse({ type: 'heartbeat', uptimeMs: 1.5 })).toThrow();
  });
});

describe('SseEventSchema (discriminated union)', () => {
  it('discriminates by `type` field', () => {
    const reportUpdated = SseEventSchema.parse({
      type: 'report.updated',
      generatedAt: '2026-05-25T10:00:00.000Z',
    });
    expect(reportUpdated.type).toBe('report.updated');

    const heartbeat = SseEventSchema.parse({ type: 'heartbeat', uptimeMs: 1 });
    expect(heartbeat.type).toBe('heartbeat');

    const shutdown = SseEventSchema.parse({ type: 'server.shutdown' });
    expect(shutdown.type).toBe('server.shutdown');
  });

  it('rejects an unknown `type`', () => {
    expect(() => SseEventSchema.parse({ type: 'unknown.event' })).toThrow();
  });

  it('rejects a missing `type`', () => {
    expect(() => SseEventSchema.parse({ uptimeMs: 0 })).toThrow();
  });
});
