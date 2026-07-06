import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RunPayload } from './types';
import { compositeScore } from './score';
import { RunHeader } from './components/RunHeader';
import { ConsequenceMap, NodeDetailStrip } from './components/ChainBoard';
import { ActionBar } from './components/ActionBar';
import { CandidateTable, type CandidateRow } from './components/CandidateTable';
import { RubricPanel } from './components/RubricPanel';
import { ThesisPanel } from './components/ThesisPanel';
import { LoginScreen } from './components/LoginScreen';
import { SearchBar } from './components/SearchBar';
import { StocksView } from './components/StocksView';
import { useSession } from './auth';
import {
  AuthError,
  NetworkError,
  OFFLINE_MSG,
  drillNode,
  fetchDemoPayload,
  getRun,
  listRuns,
  search,
  type RunSummary,
} from './api';

const RUNNING_NOTE =
  'Running the chain. New searches take a few minutes while filings are read and scored.';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: RunPayload };

type Tab = 'scenarios' | 'stocks';

export function App() {
  const { session, signIn, signOut, refresh } = useSession();
  const token = session?.token ?? null;

  const [tab, setTab] = useState<Tab>('scenarios');
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [offline, setOffline] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [drillingNodeId, setDrillingNodeId] = useState<string | null>(null);
  const [drillNote, setDrillNote] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPayload = useCallback((payload: RunPayload) => {
    setState({ status: 'ready', payload });
    setOffline(false);
    setWeights({ ...payload.run.rubric.weights });
    setSelectedNodeId(null);
    setSelectedTicker(null);
    setDrillingNodeId(null);
    setDrillNote(null);
  }, []);

  const loadDemo = useCallback(async () => {
    try {
      const payload = await fetchDemoPayload();
      applyPayload(payload);
      setOffline(true);
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [applyPayload]);

  const handleAuthError = useCallback(() => {
    // Treat a 401 as signed-out.
    signOut();
  }, [signOut]);

  // Poll a running run until it is ready.
  const pollRun = useCallback(
    (runId: string) => {
      if (!token) return;
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = setTimeout(async () => {
        try {
          const result = await getRun(token, runId);
          if (result && result.status === 'ready') {
            setBusy(false);
            setStatusNote(null);
            applyPayload(result.payload);
          } else {
            setStatusNote(RUNNING_NOTE);
            pollRun(runId);
          }
        } catch (err) {
          if (err instanceof AuthError) {
            handleAuthError();
          } else if (err instanceof NetworkError) {
            setBusy(false);
            setStatusNote(null);
            loadDemo();
          } else {
            setBusy(false);
            setStatusNote(err instanceof Error ? err.message : String(err));
          }
        }
      }, 2000);
    },
    [token, applyPayload, handleAuthError, loadDemo],
  );

  const openRun = useCallback(
    async (runId: string) => {
      if (!token) return;
      setBusy(true);
      setMessage(null);
      setState({ status: 'loading' });
      try {
        const result = await getRun(token, runId);
        if (!result) {
          setBusy(false);
          setState({ status: 'error', message: `Run ${runId} not found.` });
          return;
        }
        if (result.status === 'ready') {
          setBusy(false);
          setStatusNote(null);
          applyPayload(result.payload);
        } else {
          setStatusNote(RUNNING_NOTE);
          pollRun(runId);
        }
      } catch (err) {
        if (err instanceof AuthError) {
          handleAuthError();
        } else if (err instanceof NetworkError) {
          setStatusNote(null);
          loadDemo();
        } else {
          setBusy(false);
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      }
    },
    [token, applyPayload, pollRun, handleAuthError, loadDemo],
  );

  const runSearch = useCallback(
    async (query: string) => {
      if (!token) return;
      setBusy(true);
      setMessage(null);
      setStatusNote(null);
      try {
        const result = await search(token, query);
        if (result.status === 'needs_model') {
          setBusy(false);
          setMessage(result.message);
          return;
        }
        if (result.status === 'running') {
          setState({ status: 'loading' });
          setStatusNote(RUNNING_NOTE);
          pollRun(result.runId);
        } else {
          openRun(result.runId);
        }
      } catch (err) {
        if (err instanceof AuthError) {
          handleAuthError();
        } else if (err instanceof NetworkError) {
          setStatusNote(null);
          setMessage(null);
          loadDemo();
        } else {
          setBusy(false);
          setMessage(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [token, search, pollRun, openRun, handleAuthError, loadDemo],
  );

  // Drill deeper on a node: synchronous on the server (30 to 90 seconds), then
  // re-fetch the run payload so new child nodes appear in the next order
  // column. Keeps the current weights and node selection.
  const handleDrill = useCallback(
    async (nodeId: string) => {
      if (state.status !== 'ready') return;
      if (!token || offline) {
        setDrillNote(OFFLINE_MSG);
        return;
      }
      const runId = state.payload.run.id;
      setDrillingNodeId(nodeId);
      setDrillNote(null);
      try {
        await drillNode(token, runId, nodeId);
        const result = await getRun(token, runId);
        if (result && result.status === 'ready') {
          setState({ status: 'ready', payload: result.payload });
        }
      } catch (err) {
        if (err instanceof AuthError) {
          handleAuthError();
        } else if (err instanceof NetworkError) {
          setDrillNote(OFFLINE_MSG);
        } else {
          setDrillNote(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setDrillingNodeId(null);
      }
    },
    [state, token, offline, handleAuthError],
  );

  // On sign in, load the run list. If the API is unreachable, fall back to demo.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listRuns(token)
      .then((r) => {
        if (!cancelled) setRuns(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AuthError) {
          handleAuthError();
        } else if (err instanceof NetworkError) {
          loadDemo();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, handleAuthError, loadDemo]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const payload = state.status === 'ready' ? state.payload : null;

  const readsByTicker = useMemo(() => {
    const m = new Map<string, RunPayload['reads'][number]>();
    for (const r of payload?.reads ?? []) m.set(r.ticker, r);
    return m;
  }, [payload]);

  const thesesByTicker = useMemo(() => {
    const m = new Map<string, RunPayload['theses'][number]>();
    for (const t of payload?.theses ?? []) m.set(t.ticker, t);
    return m;
  }, [payload]);

  const dossiersByTicker = useMemo(() => {
    const m = new Map<string, RunPayload['dossiers'][number]>();
    for (const d of payload?.dossiers ?? []) m.set(d.ticker, d);
    return m;
  }, [payload]);

  // Split candidates by the polarity of their map node: beneficiary nodes feed
  // the long table, at_risk nodes feed the short table. Candidates whose node
  // is missing count as beneficiary. Each side keeps the existing internal
  // ordering: scored by composite, then in-band by FTS hits, then filtered out.
  const { longRows, shortRows } = useMemo(() => {
    const empty = { longRows: [] as CandidateRow[], shortRows: [] as CandidateRow[] };
    if (!payload) return empty;
    const exposureGate = payload.run.rubric.exposureGate;
    const polarityByNode = new Map<string, string>();
    for (const n of payload.chain) polarityByNode.set(n.id, n.polarity);
    const all = payload.candidates
      .filter((c) => (selectedNodeId ? c.nodeId === selectedNodeId : true))
      .map((c) => {
        const read = readsByTicker.get(c.ticker) ?? null;
        return {
          candidate: c,
          read,
          score: read ? compositeScore(read, weights, exposureGate) : null,
          hasThesis: thesesByTicker.has(c.ticker),
          dossier: dossiersByTicker.get(c.ticker) ?? null,
        };
      });
    const order = (rows: CandidateRow[]) => {
      const scored = rows
        .filter((r) => r.read !== null && r.candidate.status !== 'filtered_out')
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const inBand = rows
        .filter((r) => r.read === null && r.candidate.status !== 'filtered_out')
        .sort((a, b) => b.candidate.ftsHits - a.candidate.ftsHits);
      const filteredOut = rows
        .filter((r) => r.candidate.status === 'filtered_out')
        .sort((a, b) => b.candidate.ftsHits - a.candidate.ftsHits);
      return [...scored, ...inBand, ...filteredOut];
    };
    return {
      longRows: order(all.filter((r) => polarityByNode.get(r.candidate.nodeId) !== 'at_risk')),
      shortRows: order(all.filter((r) => polarityByNode.get(r.candidate.nodeId) === 'at_risk')),
    };
  }, [payload, weights, selectedNodeId, readsByTicker, thesesByTicker, dossiersByTicker]);

  // Login gate.
  if (!session) {
    return <LoginScreen onSignIn={signIn} onSession={refresh} />;
  }

  const openThesis = selectedTicker ? thesesByTicker.get(selectedTicker) ?? null : null;
  const openRead = selectedTicker ? readsByTicker.get(selectedTicker) ?? null : null;
  const openDossier = selectedTicker ? dossiersByTicker.get(selectedTicker) ?? null : null;
  const openComposite = openRead
    ? compositeScore(openRead, weights, payload?.run.rubric.exposureGate)
    : null;

  const selectedNode =
    payload && selectedNodeId ? payload.chain.find((n) => n.id === selectedNodeId) ?? null : null;
  const parentNode =
    payload && selectedNode && selectedNode.parentId
      ? payload.chain.find((n) => n.id === selectedNode.parentId) ?? null
      : null;

  const topbarRow = (
    <div className="topbar-row">
      <span className="wordmark">Corollary</span>
      <nav className="app-tabs" aria-label="Sections">
        <button
          type="button"
          className={tab === 'scenarios' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setTab('scenarios')}
        >
          Scenarios
        </button>
        <button
          type="button"
          className={tab === 'stocks' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setTab('stocks')}
        >
          Stocks
        </button>
      </nav>
      <div className="account-bar">
        <span className="account-email mono">{session.email}</span>
        <button type="button" className="link-btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );

  const searchFront = (
    <SearchBar
      onRun={runSearch}
      runs={runs}
      onPickRun={openRun}
      busy={busy}
      statusNote={statusNote}
      message={message}
    />
  );

  const body = (() => {
    if (state.status === 'idle') {
      return (
        <p className="page-message">
          Enter a scenario, thesis, or theme above, or pick an existing run to load results.
        </p>
      );
    }
    if (state.status === 'loading') {
      return <p className="page-message">Loading run data.</p>;
    }
    if (state.status === 'error') {
      return <p className="page-message">Could not load run data: {state.message}</p>;
    }
    if (!payload) return null;
    return (
      <div className={openThesis ? 'app-shell with-panel' : 'app-shell'}>
        <main className="main-col">
          {offline && (
            <p className="offline-note">Offline demo data (API not running)</p>
          )}
          <RunHeader run={payload.run} macro={payload.macro ?? null} />
          <ActionBar
            key={payload.run.id}
            token={token}
            runId={payload.run.id}
            chain={payload.chain}
            offline={offline}
            onOpenRun={openRun}
          />
          <ConsequenceMap
            seed={payload.run.seed}
            chain={payload.chain}
            candidates={payload.candidates}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
          {selectedNode && (
            <NodeDetailStrip
              node={selectedNode}
              parent={parentNode}
              drilling={drillingNodeId === selectedNode.id}
              drillNote={drillNote}
              onDrill={handleDrill}
            />
          )}
          <CandidateTable
            longRows={longRows}
            shortRows={shortRows}
            chain={payload.chain}
            selectedTicker={selectedTicker}
            selectedNodeId={selectedNodeId}
            onClearNode={() => setSelectedNodeId(null)}
            onSelectRow={(t) => setSelectedTicker((cur) => (cur === t ? null : t))}
          />
          <RubricPanel
            rubric={payload.run.rubric}
            weights={weights}
            onChange={(key, value) => setWeights((w) => ({ ...w, [key]: value }))}
            onReset={() => setWeights({ ...payload.run.rubric.weights })}
          />
        </main>
        {openThesis && (
          <ThesisPanel
            thesis={openThesis}
            read={openRead}
            dossier={openDossier}
            weights={weights}
            composite={openComposite}
            exposureGate={payload?.run.rubric.exposureGate}
            onClose={() => setSelectedTicker(null)}
          />
        )}
      </div>
    );
  })();

  return (
    <div className="app-root">
      <div className="app-topbar">
        {topbarRow}
        {tab === 'scenarios' && searchFront}
      </div>
      {tab === 'scenarios' ? body : <StocksView token={token} onAuthError={handleAuthError} />}
    </div>
  );
}
