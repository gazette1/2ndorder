# Corollary outreach kit

Everything here is written for Russ to send personally from his own email.
No automated sending, no purchased lists, no scraped contact databases.

## Materials

- **One-pager**: docs/sales/one-pager.html. Print to PDF for attachments;
  the page prints to one sheet.
- **30-second film**: docs/sales/corollary-demo-30s-final.mp4. Too large to
  attach to email (31MB); host it first. Best home: the landing page itself
  once corollaryresearch.com is live, or an unlisted YouTube link as a stopgap.
  Use it as the one link in a follow-up, a LinkedIn post, or on the landing
  page. Do not attach video files to cold email; a 31MB attachment from an
  unknown sender is a spam signal.
- **The product**: the strongest material is a live run. Every demo email
  address goes on the allowlist before the meeting.
- **Target universe (ET, sub-20 employees)**: docs/sales/targets-est.md and
  targets-est.json. 961 hedge fund advisers with a main office in an Eastern
  time state and under 20 employees on Form ADV, 848 with a public website.
  This is the primary list; the DC-area 13F list (targets.md) is a subset.
- **The loop and its parts**: docs/sales/gtm.md (strategy), thesis-to-idea.md
  (how to turn a firm's view into the idea you send), outreach-flow.html (the
  visual flow chart of the whole cadence).

## The contact question, answered straight

Form ADV gives the firm-level public contact for every adviser: business
address, phone, and website. That is what targets-est.md carries. It does not
carry individual personal emails, and this kit does not compile them, on
purpose. The compliant path to a person is per-firm and manual, at the moment
you send:
- Read the firm's own site or LinkedIn for the PM or analyst who wrote the
  thesis you are responding to. One name, one firm, at send time.
- Reach them the way targets.md already prescribes: a warm intro first, then
  a public-source address, one at a time. Never a bulk-enrichment tool run
  across the whole list, never a purchased database. At two or three sends a
  day this is not a bottleneck.
- The firm phone from ADV is a legitimate fallback for a Tier 1 firm that
  does not answer email.

## Who to target and how to find them

The pitch fits funds where one PM or a two-analyst team covers hundreds of
SMID names and cannot read every 10-K. Concretely:

1. **13F filers in Baltimore, DC, and Northern Virginia with $50MM to $2B
   reported.** SEC full-text search (efts.sec.gov) filters 13F-HR filings by
   the business address on the cover page. That size band means real money
   but no internal data science team.
2. **Fund websites and LinkedIn company pages** for names surfaced in step 1.
   Look for "fundamental", "small cap", "SMID", "concentrated" in their own
   language. A quant shop will not care; a five-person fundamental shop will.
3. **CFA Society Baltimore and CFA Society Washington DC events.** Both post
   public event calendars. One conversation at an event beats twenty cold
   emails, and membership is cheap for a candidate.
4. **Warm paths first.** Professors, former classmates, anyone at a fund
   admin or prime broker. Ask for a fifteen-minute intro, not a sale.

What not to do: no bulk email, no LinkedIn automation, no contact lists
bought or scraped. Every message goes out one at a time, personalized, from
russellharrisrei@gmail.com or a corollaryresearch.com address once DNS is
live. A custom-domain address will land better; set up
russ@corollaryresearch.com when the domain is configured.

## The T. Rowe Price question

Russ is also a candidate for the New Horizons associate analyst seat. Two
rules keep these compatible:

- Do not pitch T. Rowe as a customer while a candidate. If an interviewer
  asks about Corollary, it is a portfolio piece that shows exactly the job
  skill (scenario work, filing-level evidence, SMID sizing discipline).
- If a fund conversation turns into paid work, disclose it in any T. Rowe
  process before signing. Funds take compliance seriously and so should the
  pitch; it is also simply the honest move.

## Cold email, version A (default)

Subject: Mapping [their stated strategy] scenarios to under-covered SMID names

Body:

> [First name],
>
> I built a research engine that takes a scenario in plain language and maps
> its first, second, and third order consequences to specific small and
> mid-cap names, long and short. Every claim is cited to the exact sentence
> in the company's 10-K, and every candidate carries a liquidity check:
> dollar ADV, days to build a position at your size, net cash, dilution risk.
>
> It has read the filings of 5,449 US-listed companies, including S-1s for
> names that have not filed a 10-K yet, so what it surfaces usually has
> little or no sell-side coverage. Each name also carries its 8-K events,
> significant holders, proxy read, and insider record, down to Form 144
> notices that precede the executed sale.
>
> I am offering it to a small number of funds as design partners before a
> paid release. The ask is 30 minutes: bring a thesis you are working on now
> and watch the engine map it live. If nothing on the screen is useful to
> you, that is a real answer and I will take it.
>
> [One sentence referencing something specific and public about their fund:
> a 13F position, a letter, a stated focus. Delete this template line.]
>
> Russ Harris
> corollaryresearch.com

## Cold email, version B (shorter, for a warm intro or second touch)

Subject: 30 minutes, your thesis, mapped to filings

Body:

> [First name],
>
> One-line version: you give me a scenario, the engine gives you the
> consequence tree and the under-covered SMID names on each branch, every
> claim cited to a 10-K sentence, bear case drafted first.
>
> I would rather show it on a thesis you actually hold than describe it.
> 30 minutes, your pick of scenario, live. Open to it?
>
> Russ Harris
> corollaryresearch.com

## Follow-up (send once, five business days later, then stop)

> [First name],
>
> Following up once on the note below. Thirty seconds of what it looks like:
> [hosted link to the demo film]. If the timing is wrong or the fit is not
> there, a one-word no is welcome and I will not write again.
>
> Russ

Drop the film line if the video is not hosted yet; a bare follow-up is
better than a broken link.

## The 30-minute demo script

Preparation, the night before:
- Ask them to bring a live thesis when confirming the meeting. If they do
  not reply with one, prepare a fallback from that week's news.
- Pre-run one scenario adjacent to their 13F so the corpus is warm and you
  have a finished map to show if the live run stalls.
- Confirm the deploy is healthy: /healthz, one fresh run end to end.

Minute 0 to 3. One sentence on what it is, then stop talking and type their
scenario in. No slides. The empty search box is the pitch.

Minute 3 to 12. The map builds. Narrate what the engine is doing: searching
EDGAR full text per node, reading filings, scoring. Click one consequence
node and read the filing sentence aloud. That moment, a claim resolving to
a primary-source sentence, is the product.

Minute 12 to 20. Open the ranked candidates, then one dossier, top to
bottom. This is where the evidence density lands:
- Reality check first: dollar ADV, days to build at their AUM, shelf on
  file. PMs trust a tool that tells them what they cannot own.
- The earnings-language read: what management leads with and what it
  buries, quarter over quarter, with the honesty caption that it reads
  press releases, not transcripts. If the run has a name where the read
  caught something (the pattern to look for: leads with adjusted EBITDA,
  buries the net loss), stop and let them read it.
- Insider record including Form 144 notices; explain once that a 144
  precedes the executed sale on the Form 4.
- Significant holders with the 13D activist tag, the proxy read, material
  8-K events with the exhibit one click away, and the sector-regulator
  check (FDA approvals for a biotech, FERC dockets for a pipeline).
Then open the counter-scenario map and show the same discipline applied
against the thesis. Point at the macro strip on the run header: the FOMC
stance and the industry series the scenario touches, all primary-source.

Minute 20 to 25. Open the IC memo export. Let them read a thesis paragraph
in silence. Bear case comes first in every draft; say why once and move on.

Minute 25 to 30. The ask, stated plainly: design partner slot, their
scenarios shape the roadmap, preview pricing locked before public release.
Then the honest limits, unprompted: delayed prices not a licensed feed,
sell-side view is stubbed, press releases stand in for call transcripts,
single-tenant preview. PMs are professional skeptics; volunteering the
limits buys more trust than any feature. If they ask what the data actually
is, docs/data-sources.md is the complete answer; knowing it cold reads as
competence.

Do not do in the demo: no fabricated numbers, no promising features that do
not exist, no naming other funds you are talking to.

## Sequencing

Done already: production hardening (auth, quotas, one-process deploy unit),
the full corpus (5,449 filers), the evidence layer, the one-pager, the
30-second film, and the starter target list (docs/sales/targets.md, 154
screened, six read-first names on top).

Remaining, in order:
1. Rotate the DeepSeek key, deploy per docs/DEPLOY.md, point
   corollaryresearch.com, set the allowlist. Set DATA_GOV_API_KEY and
   CENSUS_API_KEY on the host so the regulator checks and the industry
   anchor run in demos.
2. Verify the deployed smoke test, then run three scenarios you would want
   a PM to accidentally click into.
3. Put the film on the landing page or an unlisted YouTube link.
4. Shortlist 10 to 15 funds from targets.md, site-check each one.
5. Send version A one at a time, two or three per day, each personalized.
6. Every demo email address goes on the allowlist before the meeting.
