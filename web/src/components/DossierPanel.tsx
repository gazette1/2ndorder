import type { Dossier, Provenance, Read } from '../types';
import { fmtUSD, fmtDateShort, fmtPriceTarget } from '../format';

const PROVENANCE_LABELS: Record<Provenance, string> = {
  sec_form4: 'SEC Form 4',
  sec_xbrl: 'SEC XBRL',
  usaspending: 'USASpending.gov',
  sec_fts: 'SEC full-text',
  finnhub: 'Finnhub',
  fmp: 'FMP',
  yahoo: 'Yahoo (delayed)',
  stub: 'stub (no key)',
};

const ACTION_LABELS: Record<string, string> = {
  upgrade: 'upgrade',
  downgrade: 'downgrade',
  initiate: 'initiate',
  reiterate: 'reiterate',
  target: 'target',
};

const TX_CAP = 8;

function SourceTag({ provenance }: { provenance: Provenance }) {
  const cls = provenance === 'stub' ? 'source-tag mono is-stub' : 'source-tag mono';
  return <span className={cls}>{PROVENANCE_LABELS[provenance]}</span>;
}

interface Props {
  dossier: Dossier;
  read?: Read | null;
}

interface FilingLink {
  key: string;
  form: string;
  filedAt: string;
  url: string;
}

export function DossierPanel({ dossier, read }: Props) {
  const { fundamentals: f, insider, customers, coverage, reality } = dossier;

  const yoy =
    f.revenueUSD !== null && f.revenuePriorUSD !== null && f.revenuePriorUSD !== 0
      ? ((f.revenueUSD - f.revenuePriorUSD) / f.revenuePriorUSD) * 100
      : null;

  const netCls =
    insider.netBuyUSD > 0
      ? 'insider-net is-buy'
      : insider.netBuyUSD < 0
        ? 'insider-net is-sell'
        : 'insider-net';

  const shownTx = insider.transactions.slice(0, TX_CAP);
  const extraTx = insider.transactions.length - shownTx.length;
  const topAwards = [...customers.govAwards]
    .sort((a, b) => b.amountUSD - a.amountUSD)
    .slice(0, 3);

  // Distinct filing documents for this ticker, from the read quotes. Deduped by
  // URL, most recent first. These are the primary source documents at SEC.
  const filings: FilingLink[] = (() => {
    const byUrl = new Map<string, FilingLink>();
    for (const q of read?.quotes ?? []) {
      if (!q.url || byUrl.has(q.url)) continue;
      byUrl.set(q.url, { key: q.url, form: q.form, filedAt: q.filedAt, url: q.url });
    }
    return [...byUrl.values()].sort((a, b) => (a.filedAt < b.filedAt ? 1 : -1));
  })();

  return (
    <section className="dossier">
      <div className="dossier-head">
        <span className="dossier-title mono">{dossier.ticker} dossier</span>
      </div>

      {/* Street view (analyst coverage) */}
      <div className="dossier-block">
        <div className="dossier-block-head">
          <h4 className="dossier-block-title">Street view</h4>
          <SourceTag provenance={coverage.provenance} />
        </div>
        <div className="street-stats">
          <div className="street-stat">
            <span className="street-stat-label">Analysts</span>
            <span className="street-stat-value mono">
              {coverage.analystCount === null ? 'not live' : coverage.analystCount}
            </span>
          </div>
          <div className="street-stat">
            <span className="street-stat-label">Consensus</span>
            <span className="street-stat-value mono">
              {coverage.consensusRating === null ? 'not live' : coverage.consensusRating}
            </span>
          </div>
          <div className="street-stat">
            <span className="street-stat-label">Mean target</span>
            <span className="street-stat-value mono">
              {coverage.priceTargetMeanUSD === null
                ? 'not live'
                : fmtPriceTarget(coverage.priceTargetMeanUSD)}
            </span>
          </div>
        </div>
        {coverage.ratingActions.length > 0 && (
          <table className="rating-table">
            <thead>
              <tr>
                <th>Firm</th>
                <th>Action</th>
                <th>Grade</th>
                <th className="num">Target</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {coverage.ratingActions.map((a, i) => {
                const actionCls =
                  a.action === 'upgrade'
                    ? 'rating-action is-up'
                    : a.action === 'downgrade'
                      ? 'rating-action is-down'
                      : 'rating-action';
                return (
                  <tr key={a.firm + a.date + i}>
                    <td>
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {a.firm}
                      </a>
                    </td>
                    <td className={actionCls}>{ACTION_LABELS[a.action] ?? a.action}</td>
                    <td className="mono">
                      {a.fromGrade ? `${a.fromGrade} to ${a.toGrade}` : a.toGrade}
                    </td>
                    <td className="num mono">{fmtPriceTarget(a.priceTargetUSD)}</td>
                    <td className="mono">{fmtDateShort(a.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="street-caveat">
          Firm and grade from sell-side aggregators. The bank reports are paywalled and not linked
          here.
        </p>
      </div>

      {/* Fundamentals */}
      <div className="dossier-block">
        <div className="dossier-block-head">
          <h4 className="dossier-block-title">Fundamentals</h4>
          <SourceTag provenance={f.provenance} />
        </div>
        <dl className="fund-grid">
          <div className="fund-item">
            <dt>Revenue</dt>
            <dd className="mono">
              {fmtUSD(f.revenueUSD)}
              {f.revenuePriorUSD !== null && (
                <span className="fund-sub">
                  prior {fmtUSD(f.revenuePriorUSD)}
                  {yoy !== null && (
                    <span className="fund-yoy">
                      {' '}
                      YoY {yoy >= 0 ? '+' : ''}
                      {yoy.toFixed(1)}%
                    </span>
                  )}
                </span>
              )}
            </dd>
          </div>
          <div className="fund-item">
            <dt>Net income</dt>
            <dd className="mono">{fmtUSD(f.netIncomeUSD)}</dd>
          </div>
          <div className="fund-item">
            <dt>R and D</dt>
            <dd className="mono">{fmtUSD(f.rdExpenseUSD)}</dd>
          </div>
          <div className="fund-item">
            <dt>Cash</dt>
            <dd className="mono">{fmtUSD(f.cashUSD)}</dd>
          </div>
          <div className="fund-item">
            <dt>As of</dt>
            <dd className="mono">{f.asOf ? fmtDateShort(f.asOf) : 'not reported'}</dd>
          </div>
        </dl>
      </div>

      {/* Insider (Form 4) */}
      <div className="dossier-block">
        <div className="dossier-block-head">
          <h4 className="dossier-block-title">Insider (Form 4)</h4>
          <SourceTag provenance={insider.provenance} />
        </div>
        <div className="insider-summary">
          <span className={netCls + ' mono'}>{fmtUSD(insider.netBuyUSD)}</span>
          <span className="insider-summary-label">
            net open-market, {insider.window}
          </span>
        </div>
        <div className="insider-counts">
          <span>buys {insider.buyCount}</span>
          <span className="dot-sep">.</span>
          <span>sells {insider.sellCount}</span>
          <span className="dot-sep">.</span>
          <span>distinct insiders {insider.distinctBuyers}</span>
        </div>
        {shownTx.length > 0 ? (
          <table className="insider-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Role</th>
                <th>Code</th>
                <th>A/D</th>
                <th className="num">Shares</th>
                <th className="num">Price</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {shownTx.map((tx, i) => (
                <tr key={tx.accession + i}>
                  <td className="mono">{fmtDateShort(tx.date)}</td>
                  <td>{tx.role}</td>
                  <td className="mono">{tx.code}</td>
                  <td className="mono">{tx.acquiredDisposed}</td>
                  <td className="num mono">{Math.round(tx.shares).toLocaleString('en-US')}</td>
                  <td className="num mono">${tx.price.toFixed(2)}</td>
                  <td className="num mono">{fmtUSD(tx.valueUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dossier-empty">No open-market transactions in window.</p>
        )}
        {extraTx > 0 && <p className="dossier-more">+{extraTx} more</p>}
      </div>

      {/* Reality check (liquidity, cash, dilution) */}
      {reality && (
        <div className="dossier-block">
          <div className="dossier-block-head">
            <h4 className="dossier-block-title">Reality check</h4>
            <span className="reality-tags">
              {reality.provenance.map((p) => (
                <SourceTag key={p} provenance={p} />
              ))}
            </span>
          </div>
          <dl className="fund-grid">
            <div className="fund-item">
              <dt>Avg daily $ volume</dt>
              <dd className="mono">
                {reality.advUSD === null ? 'not available' : fmtUSD(reality.advUSD)}
              </dd>
            </div>
            <div className="fund-item">
              <dt>Days to build</dt>
              <dd className="mono">
                {reality.daysToBuild === null
                  ? 'not available'
                  : `${reality.daysToBuild} trading days`}
                <span className="fund-sub">$5MM position at 15 percent of volume</span>
              </dd>
            </div>
            <div className="fund-item">
              <dt>Net cash</dt>
              <dd
                className={
                  reality.netCashUSD !== null && reality.netCashUSD > 0
                    ? 'mono is-cash-pos'
                    : reality.netCashUSD !== null && reality.netCashUSD < 0
                      ? 'mono is-cash-neg'
                      : 'mono'
                }
              >
                {fmtUSD(reality.netCashUSD)}
              </dd>
            </div>
            <div className="fund-item">
              <dt>Runway</dt>
              <dd className="mono">
                {reality.runwayQuarters === null
                  ? 'self-funding'
                  : `${reality.runwayQuarters} quarters`}
              </dd>
            </div>
            <div className="fund-item">
              <dt>Share count 12m</dt>
              <dd
                className={
                  reality.sharesChangePct !== null && reality.sharesChangePct > 10
                    ? 'mono is-dilution'
                    : 'mono'
                }
              >
                {reality.sharesChangePct === null
                  ? 'not available'
                  : `${reality.sharesChangePct >= 0 ? '+' : ''}${reality.sharesChangePct.toFixed(1)}%`}
              </dd>
            </div>
            <div className="fund-item">
              <dt>Shelf on file</dt>
              <dd className={reality.shelfOnFile ? 'mono is-shelf' : 'mono'}>
                {reality.shelfOnFile ? 'yes (S-3 or 424B5)' : 'no'}
              </dd>
            </div>
          </dl>
          {reality.flags.length > 0 && (
            <ul className="reality-flags">
              {reality.flags.map((flag, i) => (
                <li key={i} className="reality-flag">
                  <span className="reality-flag-mark mono">flag:</span> {flag}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Customer graph */}
      <div className="dossier-block">
        <div className="dossier-block-head">
          <h4 className="dossier-block-title">Customer graph</h4>
          <SourceTag provenance={customers.provenance} />
        </div>
        <div className="cust-line">
          <span className="cust-label">Government awards (government):</span>{' '}
          <span className="mono">{fmtUSD(customers.govAwardTotalUSD)}</span> across{' '}
          {customers.govAwards.length} award{customers.govAwards.length === 1 ? '' : 's'}
        </div>
        {topAwards.length > 0 && (
          <table className="award-table">
            <thead>
              <tr>
                <th>Agency</th>
                <th className="num">Amount</th>
                <th>Award id</th>
              </tr>
            </thead>
            <tbody>
              {topAwards.map((a) => (
                <tr key={a.awardId}>
                  <td>{a.agency}</td>
                  <td className="num mono">{fmtUSD(a.amountUSD)}</td>
                  <td className="mono">{a.awardId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="cust-line">
          <span className="cust-label">Reverse citations:</span>{' '}
          <span className="mono">{customers.reverseCiteCount}</span> other filer
          {customers.reverseCiteCount === 1 ? '' : 's'} name the company
        </div>
        <div className="cust-line">
          <span className="cust-label">Named customers (enterprise):</span>{' '}
          {customers.namedCustomers.length > 0 ? (
            customers.namedCustomers.join(', ')
          ) : (
            <span className="dossier-empty-inline">none named in filings</span>
          )}
        </div>
      </div>

      {/* SEC filings (primary source documents) */}
      {filings.length > 0 && (
        <div className="dossier-block">
          <div className="dossier-block-head">
            <h4 className="dossier-block-title">SEC filings</h4>
            <span className="source-tag mono">SEC EDGAR</span>
          </div>
          <p className="filings-note">
            Open or download the underlying filing documents cited for {dossier.ticker}.
          </p>
          <ul className="filings-list">
            {filings.map((fl) => (
              <li key={fl.key}>
                <a href={fl.url} target="_blank" rel="noreferrer">
                  {fl.form}, filed {fmtDateShort(fl.filedAt)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
