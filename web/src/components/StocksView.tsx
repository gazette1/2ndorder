// Stocks tab: search any company in the research corpus, then view its card.
// Every card is built from the company's own 10-K; every claim carries the
// filing sentence it came from. Search is debounced against /api/companies,
// clicking a result fetches /api/companies/:ticker.

import { useEffect, useRef, useState } from 'react';
import type { CompanyCard } from '../types';
import {
  AuthError,
  NetworkError,
  OFFLINE_MSG,
  buildCompanyCard,
  getCompanyCard,
  searchCompanies,
  type CompanyCardResponse,
  type CompanySearchResponse,
} from '../api';
import { capSourceLabel, fmtCapMM, fmtDateShort } from '../format';

const EXPLAINER =
  'Every company card is built from its own 10-K, every claim carries the filing sentence it came from.';

type Stance = CompanyCard['exposures'][number]['stance'];

const STANCE_ORDER: Stance[] = ['core_product', 'active_investment', 'risk_mention'];

const STANCE_LABELS: Record<Stance, string> = {
  core_product: 'Core product',
  active_investment: 'Active investment',
  risk_mention: 'Risk mention only',
};

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; response: CompanySearchResponse }
  | { status: 'error'; message: string };

type CardState =
  | { status: 'idle' }
  | { status: 'loading'; ticker: string }
  | { status: 'ready'; response: CompanyCardResponse }
  | { status: 'not_found'; ticker: string }
  | { status: 'error'; message: string };

type BuildState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'error'; message: string };

// The no-match state only knows the raw query text, so the on-demand carding
// button is offered only when the query looks like a ticker: 1 to 5
// characters, letters with dots or hyphens allowed.
const TICKER_RE = /^[A-Za-z][A-Za-z.-]{0,4}$/;

const NOT_FILER_MSG = 'Not a US-listed SEC filer under this ticker.';
const BUILD_FAILED_MSG =
  'Could not build a card: no 10-K on file, or its sections could not be extracted.';

interface Props {
  token: string | null;
  onAuthError: () => void;
}

export function StocksView({ token, onAuthError }: Props) {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [cardState, setCardState] = useState<CardState>({ status: 'idle' });
  const [buildState, setBuildState] = useState<BuildState>({ status: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced corpus search: 250ms after the last keystroke, min 1 char.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    setBuildState((cur) => (cur.status === 'working' ? cur : { status: 'idle' }));
    // A stale not-found note would offer a second carding button under the
    // new query's no-match state, so it clears on any query change.
    setCardState((cur) => (cur.status === 'not_found' ? { status: 'idle' } : cur));
    if (!q) {
      setSearchState({ status: 'idle' });
      return;
    }
    if (!token) {
      setSearchState({ status: 'error', message: OFFLINE_MSG });
      return;
    }
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      setSearchState((cur) => (cur.status === 'ready' ? cur : { status: 'loading' }));
      try {
        const response = await searchCompanies(token, q);
        if (!cancelled) setSearchState({ status: 'ready', response });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthError) {
          onAuthError();
        } else if (err instanceof NetworkError) {
          setSearchState({ status: 'error', message: OFFLINE_MSG });
        } else {
          setSearchState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, onAuthError]);

  const openCard = async (ticker: string) => {
    if (!token) {
      setCardState({ status: 'error', message: OFFLINE_MSG });
      return;
    }
    setBuildState((cur) => (cur.status === 'working' ? cur : { status: 'idle' }));
    setCardState({ status: 'loading', ticker });
    try {
      const response = await getCompanyCard(token, ticker);
      if (response === null) {
        setCardState({ status: 'not_found', ticker });
      } else {
        setCardState({ status: 'ready', response });
      }
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
      } else if (err instanceof NetworkError) {
        setCardState({ status: 'error', message: OFFLINE_MSG });
      } else {
        setCardState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  // On-demand carding for a ticker the corpus missed. Synchronous, roughly 20
  // to 60 seconds: the server downloads and reads the 10-K live. On success
  // the returned card renders like a normal detail view and the search is
  // re-run so the results list and corpus size line pick up the new card.
  const buildCard = async (ticker: string) => {
    if (!token) {
      setBuildState({ status: 'error', message: OFFLINE_MSG });
      return;
    }
    setBuildState({ status: 'working' });
    try {
      const result = await buildCompanyCard(token, ticker);
      if (result.status === 'ready') {
        setBuildState({ status: 'idle' });
        setCardState({ status: 'ready', response: result.response });
        const q = query.trim();
        if (q) {
          try {
            const response = await searchCompanies(token, q);
            setSearchState({ status: 'ready', response });
          } catch {
            // Keep the current results if the refresh fails; the card is shown.
          }
        }
      } else if (result.status === 'needs_model') {
        setBuildState({ status: 'error', message: result.message });
      } else if (result.status === 'not_filer') {
        setBuildState({ status: 'error', message: NOT_FILER_MSG });
      } else {
        setBuildState({ status: 'error', message: BUILD_FAILED_MSG });
      }
    } catch (err) {
      if (err instanceof AuthError) {
        onAuthError();
      } else if (err instanceof NetworkError) {
        setBuildState({ status: 'error', message: OFFLINE_MSG });
      } else {
        setBuildState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };

  const buildOffer = (ticker: string) => (
    <div className="build-offer">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => buildCard(ticker)}
        disabled={buildState.status === 'working'}
      >
        Read its 10-K now
      </button>
      {buildState.status === 'working' && (
        <p className="stocks-message">Reading the 10-K. This takes about half a minute.</p>
      )}
      {buildState.status === 'error' && <p className="stocks-message">{buildState.message}</p>}
    </div>
  );

  const trimmedQuery = query.trim();

  return (
    <div className="stocks-wrap">
      <input
        className="search-input"
        style={{ width: '100%' }}
        type="text"
        placeholder="Search a ticker or company name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search a ticker or company name"
      />

      {searchState.status === 'idle' && <p className="stocks-explainer">{EXPLAINER}</p>}
      {searchState.status === 'loading' && <p className="stocks-message">Searching the corpus.</p>}
      {searchState.status === 'error' && <p className="stocks-message">{searchState.message}</p>}

      {searchState.status === 'ready' && (
        <>
          {searchState.response.results.length === 0 ? (
            <>
              <p className="stocks-message">No match in the corpus.</p>
              {TICKER_RE.test(trimmedQuery) && buildOffer(trimmedQuery.toUpperCase())}
            </>
          ) : (
            <ul className="stock-results">
              {searchState.response.results.map((hit) => (
                <li key={hit.ticker}>
                  <button type="button" className="stock-result" onClick={() => openCard(hit.ticker)}>
                    <span className="stock-result-ticker">{hit.ticker}</span>
                    <span className="stock-result-name">{hit.name}</span>
                    <span className="stock-result-tags">
                      {hit.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </span>
                    <span className="stock-result-date">{hit.filedAt}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="stocks-corpus-note">
            {searchState.response.corpusSize.toLocaleString('en-US')} companies in the research
            corpus
          </p>
        </>
      )}

      {cardState.status === 'loading' && (
        <p className="stocks-message">Loading the card for {cardState.ticker}.</p>
      )}
      {cardState.status === 'not_found' && (
        <>
          <p className="stocks-message">This ticker is not in the corpus yet.</p>
          {buildOffer(cardState.ticker.toUpperCase())}
        </>
      )}
      {cardState.status === 'error' && <p className="stocks-message">{cardState.message}</p>}
      {cardState.status === 'ready' && <CompanyCardView response={cardState.response} />}
    </div>
  );
}

function CompanyCardView({ response }: { response: CompanyCardResponse }) {
  const { card, marketCapMM, capSource } = response;

  const exposureGroups = STANCE_ORDER.map((stance) => ({
    stance,
    items: card.exposures.filter((e) => e.stance === stance),
  })).filter((g) => g.items.length > 0);

  return (
    <article className="stock-card">
      <header className="stock-card-head">
        <div className="stock-card-topline">
          <span className="stock-ticker-big">{card.ticker}</span>
          <span className="stock-name">{card.name}</span>
        </div>
        <div className="stock-cap-line">
          {marketCapMM !== null ? (
            <>
              <span className="stock-cap">{fmtCapMM(marketCapMM)}</span>
              <span className="cap-note">{capSourceLabel(capSource)}</span>
            </>
          ) : (
            <span className="cap-note">market cap not sized</span>
          )}
        </div>
      </header>

      <section className="stock-section">
        <h3 className="stock-section-title">Business</h3>
        <p className="stock-business">{card.business}</p>
      </section>

      {card.sellsTo.length > 0 && (
        <section className="stock-section">
          <h3 className="stock-section-title">Sells to</h3>
          <div className="sells-chips">
            {card.sellsTo.map((s) => (
              <span key={s} className="tag-chip">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {(card.namedCustomers.length > 0 || card.namedSuppliers.length > 0) && (
        <section className="stock-section">
          {card.namedCustomers.length > 0 && (
            <p className="stock-line">
              <span className="stock-line-label">Named customers:</span>{' '}
              {card.namedCustomers.join(', ')}
            </p>
          )}
          {card.namedSuppliers.length > 0 && (
            <p className="stock-line">
              <span className="stock-line-label">Named suppliers:</span>{' '}
              {card.namedSuppliers.join(', ')}
            </p>
          )}
        </section>
      )}

      {exposureGroups.length > 0 && (
        <section className="stock-section">
          <h3 className="stock-section-title">Theme exposures</h3>
          {exposureGroups.map((group) => (
            <div
              key={group.stance}
              className={
                group.stance === 'risk_mention' ? 'exposure-group is-risk' : 'exposure-group'
              }
            >
              <h4 className="exposure-group-title">{STANCE_LABELS[group.stance]}</h4>
              {group.items.map((e, i) => (
                <div key={e.tag + i} className="exposure-item">
                  <span className="tag-chip">{e.tag}</span>
                  <blockquote className="exposure-sentence">{e.sentence}</blockquote>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {card.catalysts.length > 0 && (
        <section className="stock-section">
          <h3 className="stock-section-title">Catalysts</h3>
          {card.catalysts.map((c, i) => (
            <div key={c.event + i} className="catalyst-item">
              <div className="catalyst-head">
                <span>{c.event}</span>
                <span className="catalyst-date">{c.date ?? 'undated'}</span>
              </div>
              <blockquote className="catalyst-sentence">{c.sentence}</blockquote>
            </div>
          ))}
        </section>
      )}

      {card.tamClaims.length > 0 && (
        <section className="stock-section">
          <h3 className="stock-section-title">TAM claims</h3>
          {card.tamClaims.map((t, i) => (
            <div key={i} className="tam-item">
              <div className="tam-claim">{t.claim}</div>
              <blockquote className="tam-sentence">{t.sentence}</blockquote>
            </div>
          ))}
        </section>
      )}

      <footer className="stock-source-line">
        <span>
          Source:{' '}
          <a href={card.source.url} target="_blank" rel="noreferrer">
            {card.source.form} filed {fmtDateShort(card.source.filedAt)}
          </a>
        </span>
        <span className="model-tag">{card.model}</span>
      </footer>
    </article>
  );
}
