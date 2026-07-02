import { useEffect, useMemo, useState } from 'react';
import type { RunPayload } from './types';
import { compositeScore } from './score';
import { RunHeader } from './components/RunHeader';
import { ChainBoard } from './components/ChainBoard';
import { CandidateTable, type CandidateRow } from './components/CandidateTable';
import { RubricPanel } from './components/RubricPanel';
import { ThesisPanel } from './components/ThesisPanel';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: RunPayload };

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/latest.json')
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'missing' });
          return null;
        }
        if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
        return res.json();
      })
      .then((payload: RunPayload | null) => {
        if (payload && !cancelled) {
          setState({ status: 'ready', payload });
          setWeights({ ...payload.run.rubric.weights });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
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

  if (state.status === 'loading') {
    return <div className="page-message">Loading run data.</div>;
  }
  if (state.status === 'missing') {
    return (
      <div className="page-message">
        No run published. Run the pipeline, then npm run stage -- publish &lt;slug&gt;.
      </div>
    );
  }
  if (state.status === 'error') {
    return <div className="page-message">Could not load run data: {state.message}</div>;
  }
  if (!payload) return null;

  const openThesis = selectedTicker ? thesesByTicker.get(selectedTicker) ?? null : null;
  const openRead = selectedTicker ? readsByTicker.get(selectedTicker) ?? null : null;
  const openDossier = selectedTicker ? dossiersByTicker.get(selectedTicker) ?? null : null;
  const openComposite = openRead ? compositeScore(openRead, weights) : null;

  return (
    <div className={openThesis ? 'app-shell with-panel' : 'app-shell'}>
      <main className="main-col">
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
}
