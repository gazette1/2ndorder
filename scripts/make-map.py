"""Generate a branded, self-contained Corollary map artifact from a completed run.

Turns data/runs/<slug> into site/maps/<out>.html: one page, fonts inlined, the
same quality as the hand-built Currie map, driven entirely by the run payload.

Usage:
  python scripts/make-map.py <run-slug> [--out <name>] [--firm "Firm Name"]
                             [--why "one-line why this fits them"]

The firm and why lines are optional personalization. Without them the page is a
clean generic map of the run. The generator prints which names it selected so
the operator can review before sending; a weak map should never go out.
"""
import argparse, base64, html, json, os, sys, textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "docs", "brand", "fonts")
OUTDIR = os.path.join(ROOT, "site", "maps")


def esc(s):
    return html.escape(str(s or ""))


def load(slug, name, default=None):
    p = os.path.join(ROOT, "data", "runs", slug, name + ".json")
    if not os.path.exists(p):
        return default
    return json.load(open(p, encoding="utf-8"))


def font_face(fam, weight, style, fn):
    b = base64.b64encode(open(os.path.join(FONTS, fn), "rb").read()).decode()
    return (f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{weight};"
            f"font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2');}}")


FONTS_CSS = "\n".join([
    font_face("Newsreader", 400, "normal", "nr400.woff2"),
    font_face("Newsreader", 500, "normal", "nr500.woff2"),
    font_face("Newsreader", 400, "italic", "nr400i.woff2"),
    font_face("IBM Plex Sans", 400, "normal", "ps400.woff2"),
    font_face("IBM Plex Sans", 500, "normal", "ps500.woff2"),
    font_face("IBM Plex Sans", 600, "normal", "ps600.woff2"),
    font_face("IBM Plex Mono", 400, "normal", "pm400.woff2"),
    font_face("IBM Plex Mono", 500, "normal", "pm500.woff2"),
])


def corpus_sentence(ticker):
    """Best filing sentence for a name: the core-product exposure from its card."""
    p = os.path.join(ROOT, "data", "corpus", "cards", ticker + ".json")
    if not os.path.exists(p):
        p = os.path.join(ROOT, "data", "corpus", "cards", "_" + ticker + ".json")
    if not os.path.exists(p):
        return None, None
    c = json.load(open(p, encoding="utf-8"))
    exps = c.get("exposures") or []
    core = [e for e in exps if e.get("stance") == "core_product" and e.get("sentence")]
    pick = (core or [e for e in exps if e.get("sentence")] or [None])[0]
    return (pick.get("sentence") if pick else None), c.get("business")


def select_names(reads, cands, scores, doss, k=2):
    """Rank by score, prefer direct/adjacent exposure and clean reality checks."""
    exp_rank = {"direct": 0, "adjacent": 1, "peripheral": 2}
    rows = []
    for r in reads:
        t = r["ticker"]
        c = next((x for x in cands if x["ticker"] == t), {})
        d = doss.get(t, {})
        flags = (d.get("reality") or {}).get("flags") or []
        rows.append({
            "ticker": t, "name": c.get("name", t),
            "cap": c.get("marketCapMM"), "exposure": r.get("exposure", ""),
            "score": scores.get(t, 0), "flags": flags,
            "reality": d.get("reality") or {}, "fund": d.get("fundamentals") or {},
        })
    rows.sort(key=lambda x: (exp_rank.get(x["exposure"], 3), len(x["flags"]), -x["score"]))
    return rows[:k], rows


def cap_str(mm):
    if mm is None:
        return "n/a"
    if mm >= 1000:
        b = mm / 1000
        return f"~${b:.2f}B".replace(".00B", "B")
    return f"~${round(mm)}MM"


def growth_str(fund):
    rev, prev = fund.get("revenueUSD"), fund.get("revenuePriorUSD")
    if rev and prev:
        return f"revenue {round((rev - prev) / prev * 100):+d}% y/y"
    return None


def node_cards(nodes):
    cols = {1: [], 2: [], 3: []}
    for n in nodes:
        o = n.get("order")
        if o in cols and len(cols[o]) < 4:
            cols[o].append(n)
    out = []
    labels = {1: "First order", 2: "Second order", 3: "Third order"}
    for o in (1, 2, 3):
        cards = []
        for n in cols[o]:
            ben = n.get("polarity") != "at_risk"
            cls = "ben" if ben else "risk"
            pol = "beneficiary" if ben else "at risk"
            cards.append(
                f'<div class="node {cls}"><div class="pol">{pol}</div>'
                f'<div class="nm">{esc(n.get("name"))}</div>'
                f'<div class="mc">{esc((n.get("mechanism") or "")[:90])}</div></div>'
            )
        out.append(f'<div><div class="col-h">{labels[o]}</div>{"".join(cards)}</div>')
    return "\n".join(out)


def clean_sentence(s, limit=210):
    """Trim to a sentence or word boundary so quotes never cut mid-word."""
    s = " ".join(str(s or "").split())
    if len(s) <= limit:
        return s
    window = s[:limit]
    end = window.rfind(". ")
    if end >= 80:
        return window[: end + 1]
    sp = window.rfind(" ")
    return window[:sp].rstrip(",;: ") + "..."


def name_card(row, tag):
    sentence, business = corpus_sentence(row["ticker"])
    if not sentence:
        sentence = business or "See the company's filings for the business description."
    sentence = clean_sentence(sentence)
    meta = [cap_str(row["cap"]) + " cap"]
    g = growth_str(row["fund"])
    if g:
        meta.append(g)
    dtb = row["reality"].get("daysToBuild")
    if dtb is not None:
        meta.append(f"{dtb} days to build")
    meta.append(f"{len(row['flags'])} reality flag" + ("" if len(row["flags"]) == 1 else "s"))
    return (
        f'<div class="name"><div class="tk">{esc(row["ticker"])} '
        f'<span class="tag">{esc(tag)}</span></div>'
        f'<h3>{esc(row["name"])}</h3>'
        f'<div class="meta">{esc(" // ".join(meta))}</div>'
        f'<div class="quote">"{esc(sentence)}"</div>'
        f'<div class="cite">source: {esc(row["ticker"])} SEC filing, business and exposure</div></div>'
    )


def build(slug, out, firm, why):
    run = load(slug, "run", {})
    nodes = (load(slug, "decompose", {}) or {}).get("nodes", [])
    cands = load(slug, "candidates", []) or []
    reads = load(slug, "reads", []) or []
    scores = load(slug, "scores", {}) or {}
    doss = {x["ticker"]: x for x in (load(slug, "dossiers", []) or [])}
    if not nodes or not reads:
        sys.exit(f"run {slug} is incomplete (need decompose + reads); generate it first")

    picks, allrows = select_names(reads, cands, scores, doss, k=2)
    tags = ["lead", "domain fit"]
    names_html = "\n".join(name_card(p, tags[i] if i < len(tags) else "candidate")
                           for i, p in enumerate(picks))

    prepared = f'<div class="prepared">Prepared for {esc(firm)}</div>' if firm else ""
    why_html = f'<p class="why">{esc(why)}</p>' if why else ""

    doc = TEMPLATE.format(
        fonts=FONTS_CSS,
        prepared=prepared,
        seed=esc(run.get("seed", "")),
        why=why_html,
        nodes=node_cards(nodes),
        names=names_html,
    )
    os.makedirs(OUTDIR, exist_ok=True)
    path = os.path.join(OUTDIR, out + ".html")
    open(path, "w", encoding="utf-8").write(doc)
    print(f"wrote {path} ({len(doc)//1024} KB)")
    print("selected names:", ", ".join(f"{p['ticker']}({p['exposure']},sc{p['score']},{len(p['flags'])}fl)" for p in picks))
    print("full ranking:", ", ".join(f"{r['ticker']}:{r['score']}" for r in allrows[:8]))


TEMPLATE = """<meta charset="utf-8" />
<title>Corollary map</title>
<style>
{fonts}
:root{{--bg:#000;--panel:#0a0a0a;--card:#111;--line:#222;--line2:#3a3a3a;--text:#f2f2f2;--muted:#9e9e9e;--faint:#5e5e5e;--accent:#fff;--ben:#4e9b6f;--ben-bg:rgba(78,155,111,0.1);--ben-bd:rgba(78,155,111,0.32);--risk:#c1595a;--risk-bg:rgba(193,89,90,0.09);--risk-bd:rgba(193,89,90,0.32);--sans:'IBM Plex Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace;--display:'Newsreader',Georgia,serif;}}
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{background:var(--bg);color:var(--text);font-family:var(--sans);padding:52px 32px 72px;font-size:15px;}}
.wrap{{max-width:900px;margin:0 auto;}}
.kicker{{font-family:var(--mono);font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;}}
.prepared{{font-family:var(--mono);font-size:12px;color:var(--faint);margin-bottom:6px;letter-spacing:0.04em;}}
h1{{font-family:var(--display);font-weight:500;font-size:30px;line-height:1.18;margin-bottom:8px;max-width:760px;text-wrap:balance;}}
.seed-note{{color:var(--muted);font-size:14px;margin-bottom:8px;}}
.why{{font-family:var(--display);font-style:italic;font-size:16px;color:var(--text);max-width:680px;margin-bottom:26px;line-height:1.5;}}
h2{{font-family:var(--display);font-weight:500;font-size:20px;margin:34px 0 14px;}}
.legend{{font-family:var(--mono);font-size:11px;color:var(--faint);display:flex;gap:18px;margin-bottom:14px;}}
.dot{{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;}}
.dot.b{{background:var(--ben);}}.dot.r{{background:var(--risk);}}
.orders{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}}
.col-h{{font-family:var(--mono);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}}
.node{{border-radius:6px;padding:9px 11px;margin-bottom:8px;border:1px solid var(--line);background:var(--panel);}}
.node.ben{{border-color:var(--ben-bd);background:var(--ben-bg);}}
.node.risk{{border-color:var(--risk-bd);background:var(--risk-bg);}}
.node .nm{{font-size:13px;font-weight:600;}}
.node .mc{{font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:2px;}}
.node .pol{{font-family:var(--mono);font-size:9.5px;letter-spacing:0.05em;text-transform:uppercase;}}
.node.ben .pol{{color:var(--ben);}}.node.risk .pol{{color:var(--risk);}}
.names{{display:grid;grid-template-columns:1fr 1fr;gap:16px;}}
.name{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;}}
.name .tk{{font-family:var(--mono);font-size:13px;color:var(--muted);}}
.name h3{{font-family:var(--display);font-weight:500;font-size:19px;margin:2px 0 4px;}}
.name .meta{{font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:10px;}}
.name .quote{{font-family:var(--display);font-style:italic;font-size:15px;line-height:1.5;color:var(--text);border-left:2px solid var(--line2);padding-left:12px;margin-bottom:10px;}}
.name .cite{{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-top:8px;}}
.tag{{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:0.04em;text-transform:uppercase;padding:1px 7px;border-radius:999px;border:1px solid var(--ben-bd);color:var(--ben);}}
.foot{{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11.5px;color:var(--faint);line-height:1.7;}}
.foot .wm{{font-family:var(--display);font-style:italic;font-weight:500;font-size:15px;color:var(--muted);}}
</style>
<div class="wrap">
  <div class="kicker">Corollary // consequence map // one page</div>
  {prepared}
  <h1>{seed}</h1>
  <p class="seed-note">First, second, and third order consequences, beneficiaries and at-risk names. Every claim below traces to the company's SEC filing.</p>
  {why}
  <h2>The map</h2>
  <div class="legend"><span><span class="dot b"></span>beneficiary</span><span><span class="dot r"></span>at risk</span><span>market caps are delayed price times reported shares</span></div>
  <div class="orders">
{nodes}
  </div>
  <h2>The names worth the read</h2>
  <div class="names">
{names}
  </div>
  <div class="foot"><span class="wm">Corollary</span> &nbsp; corollaryresearch.com<br />Primary sources: SEC EDGAR. Market caps are delayed price times reported shares, not a licensed feed. Not investment advice.</div>
</div>"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--out")
    ap.add_argument("--firm", default="")
    ap.add_argument("--why", default="")
    a = ap.parse_args()
    build(a.slug, a.out or a.slug, a.firm, a.why)
