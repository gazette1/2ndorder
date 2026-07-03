// Action bar: run-level actions rendered as a row under the run header.
// Export IC memo, counter-scenario (async with polling), EDGAR alerts, and a
// 13F overlay form. Each action degrades to a plain muted message when the API
// server is not reachable.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChainNode, Overlay } from '../types';
import {
  AuthError,
  NetworkError,
  OFFLINE_MSG,
  fetchAlerts,
  fetchMemoBlobUrl,
  fetchOverlay,
  getRun,
  startCounter,
  type AlertsResult,
} from '../api';
import { fmtDateShort, fmtUSD } from '../format';

type CounterState =
  | { kind: 'idle' }
  | { kind: 'running'; runId: string }
  | { kind: 'ready'; runId: string }
  | { kind: 'error'; note: string };

type AlertsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: AlertsResult }
  | { kind: 'error'; note: string };

type OverlayState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; overlay: Overlay }
  | { kind: 'error'; note: string };

function noteFor(err: unknown): string {
  if (err instanceof NetworkError) return OFFLINE_MSG;
  if (err instanceof AuthError) return 'Session expired. Sign in again.';
  return err instanceof Error ? err.message : String(err);
}

interface Props {
  token: string | null;
  runId: string;
  chain: ChainNode[];
  offline: boolean;
  onOpenRun: (runId: string) => void;
}

export function ActionBar({ token, runId, chain, offline, onOpenRun }: Props) {
  const [memoBusy, setMemoBusy] = useState(false);
  const [memoNote, setMemoNote] = useState<string | null>(null);
  const [counter, setCounter] = useState<CounterState>({ kind: 'idle' });
  const [alerts, setAlerts] = useState<AlertsState>({ kind: 'idle' });
  const [overlay, setOverlay] = useState<OverlayState>({ kind: 'idle' });
  const [fund, setFund] = useState('');

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const guardOffline = (set: (note: string) => void): boolean => {
    if (offline || !token) {
      set(OFFLINE_MSG);
      return true;
    }
    return false;
  };

  const exportMemo = async () => {
    if (guardOffline(setMemoNote)) return;
    setMemoBusy(true);
    setMemoNote(null);
    try {
      const url = await fetchMemoBlobUrl(token as string, runId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setMemoNote(noteFor(err));
    } finally {
      setMemoBusy(false);
    }
  };

  const pollCounter = (counterRunId: string) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      try {
        const result = await getRun(token as string, counterRunId);
        if (result && result.status === 'ready') {
          setCounter({ kind: 'ready', runId: counterRunId });
        } else {
          pollCounter(counterRunId);
        }
      } catch (err) {
        setCounter({ kind: 'error', note: noteFor(err) });
      }
    }, 3000);
  };

  const runCounter = async () => {
    if (guardOffline((note) => setCounter({ kind: 'error', note }))) return;
    setCounter({ kind: 'running', runId: '' });
    try {
      const result = await startCounter(token as string, runId);
      if (result.status === 'ready') {
        setCounter({ kind: 'ready', runId: result.runId });
      } else {
        setCounter({ kind: 'running', runId: result.runId });
        pollCounter(result.runId);
      }
    } catch (err) {
      setCounter({ kind: 'error', note: noteFor(err) });
    }
  };

  const checkAlerts = async () => {
    if (guardOffline((note) => setAlerts({ kind: 'error', note }))) return;
    setAlerts({ kind: 'loading' });
    try {
      const result = await fetchAlerts(token as string, runId, true);
      if (!result) {
        setAlerts({ kind: 'error', note: OFFLINE_MSG });
      } else {
        setAlerts({ kind: 'ready', result });
      }
    } catch (err) {
      setAlerts({ kind: 'error', note: noteFor(err) });
    }
  };

  const runOverlay = async (e: FormEvent) => {
    e.preventDefault();
    const query = fund.trim();
    if (!query) return;
    if (guardOffline((note) => setOverlay({ kind: 'error', note }))) return;
    setOverlay({ kind: 'loading' });
    try {
      const result = await fetchOverlay(token as string, runId, query);
      setOverlay({ kind: 'ready', overlay: result });
    } catch (err) {
      setOverlay({ kind: 'error', note: noteFor(err) });
    }
  };

  const nodeName = (id: string | null) =>
    id ? chain.find((n) => n.id === id)?.name ?? id : '';

  const busyOverlay = overlay.kind === 'loading';

  return (
    <div className="action-bar-wrap">
      <div className="action-bar">
        <button type="button" className="btn-secondary" onClick={exportMemo} disabled={memoBusy}>
          {memoBusy ? 'Preparing memo...' : 'Export IC memo'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={runCounter}
          disabled={counter.kind === 'running'}
        >
          {counter.kind === 'running' ? 'Running counter...' : 'Counter-scenario'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={checkAlerts}
          disabled={alerts.kind === 'loading'}
        >
          {alerts.kind === 'loading' ? 'Checking EDGAR...' : 'Check alerts'}
        </button>
        <form className="overlay-form" onSubmit={runOverlay}>
          <label className="overlay-label" htmlFor="overlay-fund">
            Overlay a 13F:
          </label>
          <input
            id="overlay-fund"
            className="overlay-input"
            type="text"
            placeholder="fund name or CIK"
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            disabled={busyOverlay}
          />
          <button type="submit" className="btn-secondary" disabled={busyOverlay || !fund.trim()}>
            {busyOverlay ? 'Matching...' : 'Overlay'}
          </button>
        </form>
      </div>

      {memoNote && <p className="action-note">{memoNote}</p>}

      {counter.kind === 'error' && <p className="action-note">{counter.note}</p>}
      {counter.kind === 'running' && counter.runId !== '' && (
        <p className="action-note">
          Counter-scenario running as run {counter.runId}. This can take a few minutes.
        </p>
      )}
      {counter.kind === 'ready' && (
        <div className="action-panel">
          <span className="action-panel-title">Counter-scenario ready.</span>{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => onOpenRun(counter.runId)}
          >
            Open run {counter.runId}
          </button>
        </div>
      )}

      {alerts.kind === 'error' && <p className="action-note">{alerts.note}</p>}
      {alerts.kind === 'ready' && (
        <div className="action-panel">
          <div className="action-panel-head">
            <span className="action-panel-title">
              Alerts since {fmtDateShort(alerts.result.since)}
            </span>
            <span className="action-panel-meta mono">
              {alerts.result.alerts.length} alert{alerts.result.alerts.length === 1 ? '' : 's'},
              checked {fmtDateShort(alerts.result.generatedAt)}
            </span>
          </div>
          {alerts.result.alerts.length === 0 ? (
            <p className="action-empty">No new filings since the run.</p>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Form</th>
                  <th>Filed</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {alerts.result.alerts.map((a, i) => (
                  <tr key={a.accession + i}>
                    <td className="mono">{a.ticker}</td>
                    <td className="mono">{a.form}</td>
                    <td className="mono">{fmtDateShort(a.filedAt)}</td>
                    <td>{a.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {overlay.kind === 'error' && <p className="action-note">{overlay.note}</p>}
      {overlay.kind === 'ready' && (
        <div className="action-panel">
          <div className="action-panel-head">
            <span className="action-panel-title">
              {overlay.overlay.fund.name}, 13F filed {fmtDateShort(overlay.overlay.fund.filedAt)}
            </span>
          </div>
          <p className="overlay-summary">
            {overlay.overlay.summary.matched} of {overlay.overlay.summary.totalPositions} positions
            matched: {overlay.overlay.summary.onBeneficiary} on beneficiary nodes,{' '}
            {overlay.overlay.summary.onAtRisk} on at-risk nodes
          </p>
          {overlay.overlay.positions.filter((p) => p.matchedTicker !== null).length > 0 && (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Issuer</th>
                  <th className="num">Value</th>
                  <th>Ticker</th>
                  <th>Node</th>
                </tr>
              </thead>
              <tbody>
                {overlay.overlay.positions
                  .filter((p) => p.matchedTicker !== null)
                  .map((p, i) => {
                    const rowCls =
                      p.polarity === 'at_risk'
                        ? 'overlay-row is-at-risk'
                        : p.polarity === 'beneficiary'
                          ? 'overlay-row is-beneficiary'
                          : 'overlay-row';
                    return (
                      <tr key={(p.matchedTicker ?? p.issuer) + i} className={rowCls}>
                        <td>{p.issuer}</td>
                        <td className="num mono">{fmtUSD(p.valueUSD)}</td>
                        <td className="mono overlay-ticker">{p.matchedTicker}</td>
                        <td className="overlay-node">{nodeName(p.nodeId)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
