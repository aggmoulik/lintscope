'use client';

import { type InitResponse, SSE_EVENT_NAMES } from '@lintscope/api-schema';
import type { LintReport } from '@lintscope/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  authedUrl,
  StudioAuthError,
  StudioConnectionError,
  StudioHttpError,
  StudioSchemaError,
  studioApi,
} from './api-client';
import type { StudioConnection } from './connection';

export type StudioDataState =
  | { kind: 'pending' }
  | { kind: 'ready'; init: InitResponse; report: LintReport }
  | { kind: 'auth-error' }
  | { kind: 'connection-error'; message: string }
  | { kind: 'schema-error'; endpoint: string; details: string };

export interface StudioDataResult {
  state: StudioDataState;
  /** Manually re-fetch the report. Returns when the new report has been applied. */
  refresh: () => Promise<void>;
}

export function useStudioData(connection: StudioConnection): StudioDataResult {
  const [state, setState] = useState<StudioDataState>({ kind: 'pending' });
  const initRef = useRef<InitResponse | null>(null);

  const handleError = useCallback((err: unknown): StudioDataState => {
    if (err instanceof StudioAuthError) return { kind: 'auth-error' };
    if (err instanceof StudioConnectionError) {
      return { kind: 'connection-error', message: err.message };
    }
    if (err instanceof StudioHttpError) {
      return {
        kind: 'connection-error',
        message: `Studio returned HTTP ${err.status}: ${err.message}`,
      };
    }
    if (err instanceof StudioSchemaError) {
      return { kind: 'schema-error', endpoint: err.endpoint, details: err.zodMessage };
    }
    return {
      kind: 'connection-error',
      message: err instanceof Error ? err.message : String(err),
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const report = await studioApi.report(connection);
      const init = initRef.current;
      if (init) setState({ kind: 'ready', init, report });
    } catch (err) {
      setState(handleError(err));
    }
  }, [connection, handleError]);

  // Initial connection: probe /init, then fetch /report.
  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'pending' });

    (async () => {
      try {
        const init = await studioApi.init(connection);
        if (cancelled) return;
        initRef.current = init;
        const report = await studioApi.report(connection);
        if (cancelled) return;
        setState({ kind: 'ready', init, report });
      } catch (err) {
        if (cancelled) return;
        setState(handleError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection, handleError]);

  // Subscribe to SSE if the server advertised watch capability.
  useEffect(() => {
    if (state.kind !== 'ready') return;
    if (!state.init.capabilities.watch) return;

    const url = authedUrl(connection, '/events');
    const es = new EventSource(url);

    const onReportUpdated = () => {
      // Re-fetch the full report. (diagnostics.delta is an optional optimization
      // we'll wire up later — refetch is simpler and always correct.)
      void refresh();
    };
    const onShutdown = () => {
      setState({
        kind: 'connection-error',
        message: 'Studio server is shutting down.',
      });
      es.close();
    };
    const onError = () => {
      // EventSource emits `error` on disconnect AND on the initial connect failure.
      // Don't tear down state on transient errors — the browser auto-reconnects.
      if (es.readyState === EventSource.CLOSED) {
        setState({
          kind: 'connection-error',
          message: 'Lost connection to studio server (event stream closed).',
        });
      }
    };

    es.addEventListener(SSE_EVENT_NAMES.reportUpdated, onReportUpdated);
    es.addEventListener(SSE_EVENT_NAMES.serverShutdown, onShutdown);
    es.addEventListener('error', onError);

    return () => {
      es.removeEventListener(SSE_EVENT_NAMES.reportUpdated, onReportUpdated);
      es.removeEventListener(SSE_EVENT_NAMES.serverShutdown, onShutdown);
      es.removeEventListener('error', onError);
      es.close();
    };
  }, [state, connection, refresh]);

  return { state, refresh };
}
