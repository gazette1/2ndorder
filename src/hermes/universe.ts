import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { sharesOutstanding, tickerMap } from '../lib/edgar.js';
import { priceUSD } from '../lib/marketdata.js';

// The market-cap-banded universe: every SEC-registered ticker, sized by delayed
// price x reported shares (both keyless), kept if inside the configured cap band.
// This is what lets any scenario or news item match against a pre-read company
// instead of depending on a lucky keyword hit at query time. Network-only, no
// LLM cost. Resumable: rerun to pick up unscanned tickers (new registrants, or
// a prior run that stopped partway); every ticker checked is recorded so it is
// never re-fetched.

export interface UniverseEntry {
  cik: string;
  ticker: string;
  name: string;
  marketCapMM: number;
}

const UNIVERSE_PATH = path.resolve('data/corpus/universe.json');

interface UniverseState {
  scannedTickers: string[];
  inBand: UniverseEntry[];
  capBandMM: [number, number];
  updatedAt: string;
}

function loadState(): UniverseState {
  if (fs.existsSync(UNIVERSE_PATH)) {
    return JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
  }
  return { scannedTickers: [], inBand: [], capBandMM: CONFIG.capBandMM, updatedAt: new Date().toISOString() };
}

function saveState(state: UniverseState) {
  fs.mkdirSync(path.dirname(UNIVERSE_PATH), { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(UNIVERSE_PATH, JSON.stringify(state, null, 2));
}

export function loadUniverse(): UniverseEntry[] | null {
  if (!fs.existsSync(UNIVERSE_PATH)) return null;
  return (loadState().inBand ?? []).filter((e) => e && e.cik && e.ticker);
}

export async function scanUniverse(capBandMM: [number, number] = CONFIG.capBandMM): Promise<UniverseEntry[]> {
  const tickers = await tickerMap();
  const state = loadState();
  const scanned = new Set(state.scannedTickers);
  const todo = [...tickers.entries()].filter(([, v]) => !scanned.has(v.ticker));

  console.log(
    `[hermes] universe scan: ${tickers.size} SEC tickers total, ${scanned.size} already checked, ${todo.length} to scan. ` +
      `Band $${capBandMM[0]}MM to $${capBandMM[1]}MM.`,
  );

  const [lo, hi] = capBandMM;
  let checked = 0;
  for (const [cik, { ticker, title }] of todo) {
    checked++;
    try {
      const price = await priceUSD(ticker);
      if (price !== null) {
        const shares = await sharesOutstanding(cik);
        if (shares !== null) {
          const capMM = Math.round((price * shares) / 1e6);
          if (capMM >= lo && capMM <= hi) {
            state.inBand.push({ cik, ticker, name: title, marketCapMM: capMM });
          }
        }
      }
    } catch {
      // one bad ticker does not stop a 9000-ticker scan
    }
    state.scannedTickers.push(ticker);
    if (checked % 250 === 0) {
      saveState(state);
      console.log(`[hermes] universe scan: ${checked}/${todo.length} checked this run, ${state.inBand.length} in band so far`);
    }
  }
  saveState(state);
  console.log(`[hermes] universe scan complete: ${state.inBand.length} companies in the $${lo}MM to $${hi}MM band`);
  return state.inBand;
}
