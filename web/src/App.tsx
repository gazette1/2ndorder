import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RunPayload } from './types';
import { compositeScore } from './score';
import { RunHeader } from './components/RunHeader';
import { ChainBoard } from './components/ChainBoard';
import { CandidateTable, type CandidateRow } from './components/CandidateTable';
import { RubricPanel } from './components/RubricPanel';
import { ThesisPanel } from './components/ThesisPanel';
import { LoginScreen } from './components/LoginScreen';
import { SearchBar } from './components/SearchBar';
import { useSession } from './auth';
import {
  AuthError,
  NetworkError,
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

export function App() {
  const { session, signIn, signOut } = useSession();
  const token = session?.token ?? null;

  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [offline, setOffline] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPayload = useCallback((payload: RunPayload) => {
    setState({ status: 'ready', payload });
    setWeights({ ...payload.run.rubric.weights });
    setSelectedNodeId(null);
    setSelectedTicker(null);
  }, []);

  const loadDemo = useCallback(async () => {
    try {
      const payload = await fetchDemoPayload();
      setOffline(true);
      applyPayload(payload);
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

  const rows: CandidateRow[] = useMemo(() => {
    if (!payload) return [];
    const all = payload.candidates
      .filter((c) => (selectedNodeId ? c.nodeId === selectedNodeId : true))
      .map((c) => {
        const read = readsByTicker.get(c.ticker) ?? null;
        return {
          candidate: c,
          read,
          score: read ? compositeScore(read, weights) : null,
          hasThesis: thesesByTicker.has(c.ticker),
          dossier: dossiersByTicker.get(c.ticker) ?? null,
        };
      });
    const scored = all
      .filter((r) => r.read !== null && r.candidate.status !== 'filtered_out')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const inBand = all
      .filter((r) => r.read === null && r.candidate.status !== 'filtered_out')
      .sort((a, b) => b.candidate.ftsHits - a.candidate.ftsHits);
    const filteredOut = all
      .filter((r) => r.candidate.status === 'filtered_out')
      .sort((a, b) => b.candidate.ftsHits - a.candidate.ftsHits);
    return [...scored, ...inBand, ...filteredOut];
  }, [payload, weights, selectedNodeId, readsByTicker, thesesByTicker, dossiersByTicker]);

  // Login gate.
  if (!session) {
    return <LoginScreen onSignIn={signIn} />;
  }

  const openThesis = selectedTicker ? thesesByTicker.get(selectedTicker) ?? null : null;
  const openRead = selectedTicker ? readsByTicker.get(selectedTicker) ?? null : null;
  const openDossier = selectedTicker ? dossiersByTicker.get(selectedTicker) ?? null : null;
  const openComposite = openRead ? compositeScore(openRead, weights) : null;

  const accountBar = (
    <div className="account-bar">
      <span className="account-email mono">{session.email}</span>
      <button type="button" className="link-btn" onClick={signOut}>
        Sign out
      </button>
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
          Search a thesis, theme, or company above, or pick an existing run to load results.
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
          <RunHeader run={payload.run} />
          <ChainBoard
            chain={payload.chain}
            candidates={payload.candidates}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
          <CandidateTable
            rows={rows}
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
            onClose={() => setSelectedTicker(null)}
          />
        )}
      </div>
    );
  })();

  return (
    <div className="app-root">
      <div className="app-topbar">
        {accountBar}
        {searchFront}
      </div>
      {body}
    </div>
  );
}
