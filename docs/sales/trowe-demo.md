# The Charles White walkthrough: Saturday, 30 minutes

Charles White (TRPA) replied to your application note and asked for 30
minutes. You listed four outcomes: license it for real money, get hired at
$150K, sell it outright around $50K, or walk away with nothing. This plan is
built around one fact: all three good outcomes come from the same behavior in
the room, and none of them comes from selling.

## The frame that wins all three outcomes

Charles replied to a JOB APPLICATION. The meeting is a work sample, not a
sales call. The demo is the resume. If the team wants to license or buy, THEY
raise it, and they will only raise it if the walkthrough makes the tool feel
indispensable. The behavior that maximizes every branch:

- Show the machine doing the job their associate analysts do, faster and with
  receipts. Let the conclusion form in their heads.
- Volunteer the limits before they probe (delayed quotes, press releases not
  transcripts, single-tenant preview). To a professional skeptic, unprompted
  honesty is the strongest competence signal there is.
- If money comes up, do not quote a number in meeting one. "It depends on
  scope. I would rather show you everything first and follow up with options."
  A number named early caps the license branch at the first figure spoken and
  reads as eager on the hire branch.
- The ask at the end is small: a longer session with the team, or a name to
  send the memo output to. Small asks get yes; the yes compounds.

One housekeeping line, first minute: your email called it Adoption Chain, the
product says Corollary. Bridge it once and move on: "I wrote to you calling
it Adoption Chain, its working name; the build is Corollary,
corollaryresearch.com."

## The 30 minutes

Timing reality, measured on the current backend: a full run takes 45 to 50
minutes because it actually reads filings, but the app now renders stages as
they land. The map appears about 2 minutes after Run, the full candidate list
(90 or so names) about 4 minutes in, and filing reads and theses keep landing
through the meeting. The demo is built around that: start his scenario first,
let the map materialize while you tour, and the finished memo of HIS scenario
becomes the follow-up email.

- 0:00-2:00. One sentence, then hands on keyboard: "The platform converts a
  real-world event into a transparent causal map: where the economic benefit
  and burden migrate, which under-followed companies sit on each path, and
  the exact filing sentence behind every claim. It does a real filing read,
  about 45 minutes end to end, so let me start yours now and it will build
  while we talk." Never say the tool predicts stocks; it maps consequences
  and makes the reasoning inspectable. That word choice is the difference
  between an analytical instrument and a black box in this room.
  Ask Charles for a thesis his desk is chewing on. If he demurs, type the
  prepared fresh one (below). Hit Run.
- 2:00-6:00. While his run decomposes, open the finished grid-capex run
  (regenerated this week, tickers verified current): the consequence map,
  the shape of first, second, third order. By the time you finish this
  orientation his map is on screen; flip to it, read the second order out
  loud, then flip back.
- 6:00-16:00. Depth tour on grid-capex: click one second-order node, the
  candidate table filtered to it, then one dossier top to bottom. Slow down
  at two moments: the filing-sentence citation (click through to the SEC
  document), and the earnings-language read with its "press releases, not
  call transcripts" caption. Then the counter-scenario button: the bear map
  exists for every bull map without being asked. Then Export IC memo; let him
  scroll it in silence for twenty seconds.
- 16:00-20:00. Stocks tab: search two names he covers, show the card and the
  on-demand "read its 10-K now" for one the corpus missed. Mention the
  article trick (paste a news link, get the scenario and its counter).
- 20:00-26:00. Back to his run: the map is complete and the candidate table
  is populated by now, with reads landing. Present exactly three names, in
  this order: the obvious beneficiary (say out loud it is probably priced
  in), the overlooked one with the strongest exposure and cleanest reality
  check, and one plausible-looking name the system DEMOTED, with the flag
  that demoted it. The rejection is the most persuasive object on the
  screen; T. Rowe can generate an initiation report on any Russell 2500
  name in minutes, so summaries are table stakes and filtering is the
  product. Close the segment: "The theses are still drafting; the finished
  memo will be in your inbox within the hour."
- 26:00-30:00. The honest limits, one paragraph on the build (5,449 filers
  carded, every evidence layer free and public, roughly ninety days of
  nights), and the close, near verbatim: "I am not trying to automate
  conviction. I am expanding the analyst's search surface, making the causal
  assumptions inspectable, and helping the team decide where proprietary
  research time is most likely to matter." Then the ask: a session with the
  team on a live thesis of theirs, and the seat. Then stop talking.

Context worth carrying into the room: Currie discussed "AI sleepers" on the
firm's podcast in August, asking which overlooked names capture the next
wave after the obvious infrastructure winners; that is this product's exact
question, so echo his framing rather than introducing your own. He also said
the firm can generate an initiation report on any Russell 2500 company in
about five minutes; never position speed or summaries as the value. The
value is causal discovery, the automatic counter-scenario, and reasoning a
PM can audit line by line. If a model question comes up: "The reasoning
layer is model-agnostic and can run through the institution's approved
models and data environment." Do not lead with any vendor's name.

Fallback if the live run errors mid-demo: say exactly that ("the model
backend hiccuped; this is why the demo has precomputed runs"), open the
battery-storage run, keep moving. Composure under a live failure is itself a
work sample.

## Outcome branches, if he raises them

- "Could we license this?" -> "That is exactly the conversation I want to
  have. Let me put together scope options after this call." (Do not improvise
  terms. A licensing number gets anchored by THEIR procurement norms, not by
  a figure you guess in the room.)
- "Would you sell it?" -> "Open to every structure, including that one. My
  priority is working on this problem, ideally inside New Horizons." (Keeps
  hire and acquire branches both alive; an outright $50K sale plus the seat
  is strictly better than either alone, and saying "yes $50K" in the room
  forecloses the license branch, which is the largest.)
- "Why should we hire you instead of just using the tool?" -> "The tool is my
  judgment, written down and made repeatable. You are not choosing between
  me and it; it is what I do on day one, pointed at your coverage."

## Before Saturday (owner checklist)

1. **Model backend, decide and fund.** Moonshot (kimi heavy tier) is
   suspended for balance; I failed the heavy tier over to deepseek-v4-pro so
   runs work today. Either recharge Moonshot at platform.moonshot.ai and
   restore the four commented LLM_HEAVY lines in .env (backup at
   .env.bak-moonshot), or stay on DeepSeek. Whichever you pick, run one full
   fresh scenario end to end on it before Saturday. DeepSeek balance is
   $38.96, dozens of runs worth.
2. **Disable Windows sleep** (Settings, Power, sleep Never on AC) if there is
   any chance you present the live site rather than localhost. The site dies
   when this PC sleeps.
3. **Demo from localhost:8731** if presenting from this machine; the tunnel
   adds a failure mode you do not need in the room. The live domain is for
   the follow-up email.
4. **Sign in as harris.russell1@gmail.com for the demo** so the day-of quota
   (12 model runs) is untouched by any rehearsal on your main email.
5. **Rehearse once end to end, timed.** Especially the minute-2 live-run
   start; a fumbled first run start is the worst possible opening.
6. **Have the follow-up ready to send within an hour of the call**: the live
   site link plus passcode, the 30-second film, the one-page map for a
   scenario HIS team mentioned, and two sentences. Speed of follow-up is a
   work sample too.

## Prepared fresh scenario (if Charles does not offer one)

"Data center construction pulls electricians and skilled trades out of
commercial and residential construction, driving wage inflation and project
delays for mid-market contractors through 2028."

Topical, second-order by construction, SMID-heavy, and not a scenario anyone
has a slide about. Do not pre-run it; the point is watching it run live.

## What was fixed for this demo (so you can say it is fresh)

- Grid-capex run re-generated with current tickers (the July run had names
  whose tickers changed or delisted in August: CGEH is now CEPL, FGMC became
  BOXABL, Avanos deregistered). Stale runs with dead tickers are archived,
  not shown.
- Counter-scenarios no longer clutter the run list; they live behind the
  Counter-scenario button on their base run.
- Stocks search ranks the company you meant first (exact ticker, ticker
  prefix, name prefix, then word matches; "olin" now returns Olin Corp, not
  Bank of South Carolina).
- Runs render progressively: the map about 2 minutes in, candidates about 4,
  reads and theses as they land, instead of a 45-minute spinner. Verified on
  a live run.
- The stale-ticker root cause is fixed corpus-wide: the SEC ticker map cache
  was frozen in July; 64 corpus entries whose tickers changed since (renames,
  share-class moves) are re-keyed to current tickers.
- The run matcher no longer resurfaces an unrelated old run when a new
  scenario shares two generic words with it ("through 2028"). Reuse now
  requires a strong topical match.
