import type { Dossier, Provenance } from '../types';
import { fmtUSD, fmtDateShort } from '../format';

const PROVENANCE_LABELS: Record<Provenance, string> = {
  sec_form4: 'SEC Form 4',
  sec_xbrl: 'SEC XBRL',
  usaspending: 'USASpending.gov',
  sec_fts: 'SEC full-text',
  finnhub: 'Finnhub',
  stub: 'stub (no key)',
};

const TX_CAP = 8;

function SourceTag({ provenance }: { provenance: Provenance }) {
  const cls = provenance === 'stub' ? 'source-tag mono is-stub' : 'source-tag mono';
  return <span className={cls}>{PROVENANCE_LABELS[provenance]}</span>;
}

interface Props {
  dossier: Dossier;
}

export function DossierPanel({ dossier }: Props) {
  const { fundamentals: f, insider, customers, estimates } = dossier;

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

  return (
    <section className="dossier">
      <div className="dossier-head">
        <span className="dossier-title mono">{dossier.ticker} dossier</span>
        <span className="dossier-coverage">
          analyst estimates:{' '}
          {estimates.analystCount === null ? (
            <span className="coverage-stub mono">not live</span>
          ) : (
            <span className="mono">{estimates.analystCount}</span>
          )}{' '}
          <SourceTag provenance={estimates.provenance} />
        </span>
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
    </section>
  );
}
