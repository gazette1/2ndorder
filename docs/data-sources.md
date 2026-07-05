# Data sources: what is wired, what is free but pending, what stays paid

Status legend: WIRED means in the synthesis now (dossier, memo, or corpus).
FREE-NEXT means a free source exists and is a build task, not a license.
PAID means the workarounds are exhausted and real coverage costs money.

## Wired into the synthesis (all free)

| Source | What it feeds | How |
| --- | --- | --- |
| 10-K / 10-Q | Corpus cards, filing reads, thesis citations | EDGAR full text and document reads (from launch) |
| 8-K current reports | Dossier "events": M&A, CEO changes, credit facilities, impairments, delistings | Item codes decoded from the submissions feed, trailing 12 months, linked to each filing (src/lib/events.ts) |
| Earnings press releases | Dossier "earnings language": what management leads with, quarter-over-quarter drift, recurring hedge phrases | EX-99 exhibits on Item 2.02 8-Ks, two most recent, light model read (src/lib/events.ts). This is the free stand-in for transcripts and is labeled as such |
| DEF 14A proxy | Dossier "governance": CEO total comp, related-party transactions, shareholder proposals | Targeted excerpts around the three anchors, light model extract, linked (src/lib/governance.ts) |
| Form 4 and Form 5 | Insider conviction signal (net open-market buys) | XML parse, officers and directors only; Form 5 added (src/lib/edgar.ts) |
| Schedule 13D/13G | Dossier "holders": significant stakes, activist intent flag | Subject-company submissions, cover-page parse of holder and percent (src/lib/holders.ts) |
| S-1 / S-11 | Corpus cards for pre-10-K IPOs | Prospectus heading extraction with TOC dot-leader rejection (src/hermes/sections.ts); verified on the Cerebras S-1 |
| Form 13F | Smart-money overlay on candidates | Infotable parse (src/lib/thirteenf.ts, from launch) |
| Competitor filings | Cross-referencing is inherent: the corpus cards every US filer, and scenario reads pull peers on the same map node | Hermes corpus, 5,200+ filers |
| Macro (FRED) | Run-level "macro context": 2 to 4 series the model deems relevant, latest level and year over year | Keyless fredgraph.csv endpoint, fixed series whitelist so the model picks, never invents (src/lib/macro.ts) |
| Job postings | Dossier "hiring": open roles and top departments, investment direction before it is disclosed | Greenhouse and Lever public board APIs, slug probe; null coverage stated honestly (src/lib/jobs.ts) |
| Government awards | Customer graph (federal revenue) | USASpending API (from launch) |
| Sector regulators | Dossier "regulator": FDA drug approvals, device clearances, and recalls for pharma and device names; FCC docket presence for telecom; FERC eLibrary documents for utilities and pipelines | Routed by SEC SIC code (src/lib/regulators.ts). openFDA and FCC ECFS use a free data.gov key (DATA_GOV_API_KEY); FERC needs none. Name matching falls back to a wildcard because FDA abbreviates sponsors (KARYOPHARM THERAPS) |
| Sell-side rating actions | Coverage block when a free key is present | Finnhub free tier seam, stub otherwise, labeled in-product |

## Free, not yet wired (build tasks, no license needed)

- FOMC minutes and Fed speeches: federalreserve.gov publishes all of it.
  Would slot into the macro context as a rates-stance sentence.
- BLS releases (CPI, PPI, JOLTS detail): the headline series already flow in
  through FRED; the BLS API v2 (free registration) adds industry-level cuts.
- Census / FRED industry series for top-down TAM checks against the TAM
  claims already extracted from filings.
- Investor presentations: many are filed as 8-K EX-99 slide decks; the same
  exhibit reader can pull them. IR-site decks are scattered and low-yield to
  scrape; the filed subset is the honest free coverage.
- Insider Form 144 (intent to sell) as a leading indicator on top of Form 4.

## Paid, workarounds exhausted (the honest list)

| Source | Best free fragment we already use or could | What money buys |
| --- | --- | --- |
| Earnings call transcripts (AlphaSense, Tegus, S&P CIQ, FactSet) | Press-release language read (wired). Some companies post transcripts or audio on IR sites; coverage is spotty and scraping aggregators violates their terms | Full Q&A text, 4 to 6 quarter language tracking, analyst question patterns. Cheapest real option: Financial Modeling Prep transcripts from about $30 a month; API Ninjas has partial coverage near $39 a month |
| Sell-side research PDFs (bank licenses) | Rating actions and price-target headlines via Finnhub free tier (seam wired); initiation coverage sometimes summarized in trade press | The actual models, assumptions, and initiation theses. Licensed per bank; practically requires broker relationships or an aggregator seat |
| Expert networks (GLG, Tegus, AlphaSense Expert) | None. This is paying humans for calls | Former-executive and channel interviews. Tegus starts around $20K to $25K a year |
| Credit card panel data (Bloomberg Second Measure, Earnest, Consumer Edge) | None with real signal. Google Trends is a weak demand proxy, free | Real-time revenue proxies ahead of the print. Institutional pricing, five figures and up |
| Web traffic and app analytics (Similarweb, Sensor Tower, data.ai) | App-store review counts and ranks are public but noisy; Cloudflare Radar gives domain rank tiers only | Panel-based traffic and download estimates. Similarweb API starts in the hundreds per month |
| Satellite and foot traffic (Placer.ai, Orbital Insight, RS Metrics) | Free Sentinel/Landsat imagery exists but turning it into signals is a data-science project, not a data source | Parking-lot counts, store visits, tank levels. Institutional pricing |
| Market research firms (Gartner, IDC, Wood Mackenzie) | Headline numbers from their own press releases; the TAM claims companies quote in filings (already extracted into cards, with the quote) | The underlying reports and analyst access. Thousands per seat |
| Licensed real-time market data (exchange feeds) | Delayed Yahoo quotes (wired, labeled as delayed and unofficial) | Real-time quotes, official redistribution rights. Exchange fees plus a vendor |
| Job-posting aggregates (LinkUp, Revelio) | Greenhouse/Lever boards (wired) cover a useful slice of growth companies | Full historical postings across all boards and ATSs, normalized |

Recommendation if one paid line item ever earns its place: transcripts first
(FMP tier, about $30 a month) since the language-drift read is the feature
PMs will use weekly, and the press-release version is the weakest link in the
free chain. Everything else on the paid list is either a human service or
priced for funds, not tools.
