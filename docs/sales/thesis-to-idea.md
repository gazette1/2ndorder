# From a firm's public thesis to the idea you send them

The middle of the outreach loop: read what a fund believes, turn it into a
Corollary scenario, and pull the two or three under-covered names the map
surfaces. The email is that output. This is the method plus real worked
examples run through the engine.

## The method, five steps

1. **Find the thesis, in their words.** Sources in order of signal:
   - The firm's own quarterly letter or website essay (many small shops on
     the ET list publish: 1 Main Capital, Bireme, Camelot Event-Driven).
   - A recent podcast, panel, or interview.
   - The 13F quarter-over-quarter delta: what they added or opened. A fresh
     concentrated add is a thesis stated in positions rather than prose.
   Reduce it to one sentence: "[Firm] believes [X] because [Y]."

2. **Cast it as a scenario, not a stock.** A thesis names a belief; a
   scenario names a change and lets consequences fall out. Convert:
   - "We like beaten-down regional banks" becomes "Regional bank
     consolidation accelerates as deposit costs normalize."
   - "AI needs power" becomes "US data center electricity demand doubles by
     2028, driving a grid and generation supercycle."
   - "Onshoring is real" becomes "Reshoring of pharmaceutical ingredient
     manufacturing accelerates under tariff and supply-security policy."
   The scenario is what the engine maps.

3. **Run it and read the second and third order.** The first order is
   obvious and already priced (banks consolidating helps big acquirers).
   The value is downstream: the advisory firm that gets paid on every deal,
   the core-systems vendor every merged bank re-platforms onto, the
   compliance software that scales with deal count. Those are the nodes to
   pull from.

4. **Pick names not already in their book.** Cross the candidate list
   against their 13F. A name they hold is not a gift; a name they missed on
   their own thesis is. Two or three is the right number, each with the
   filing sentence behind it.

5. **Write the one-sentence "why this fits them."** The email leads with
   this: "You wrote that X; the second order of that points at [NAME],
   which nobody covers, and here is the 10-K sentence that says why."

## Worked example one: pharmaceutical reshoring (run live)

Thesis (the kind a supply-chain or industrials-tilted fund states):
onshoring of drug manufacturing accelerates under tariff and
supply-security policy.

Scenario run: "Reshoring of pharmaceutical ingredient manufacturing to the
US accelerates under tariff and supply-security policy."

What the engine returned (real run, every claim filing-cited): the map went
first order to API manufacturers, second and third order to names most desks
would not connect to the headline, including Centrus Energy (LEU, nuclear
fuel supply security), FutureFuel (FF, specialty chemical manufacturing),
and Niagen Bioscience (NAGE). Each candidate carried its reality check
(days-to-build, runway, dilution), its insider record, and a sector
regulator read (FDA approvals for the pharma names). The counter-scenario
ran automatically: what breaks the thesis if reshoring stalls.

The gift email to a fund holding the obvious onshoring names: "Your onshoring
view has a second order most people miss. The engine maps it to [name] and
[name], both under $2B, thin coverage, and the claims trace to their own
10-Ks. Full map attached."

## Worked example two: regional bank consolidation (run live)

Thesis (a financials or event-driven fund, common on the CT and NY list):
subscale banks sell as deposit costs normalize and scale wins.

Scenario run: "Regional and community bank consolidation accelerates as
deposit costs normalize and subscale banks sell to acquirers seeking
efficiency and fee income."

What the engine returned (real run, 14 map nodes, every claim filing-cited).
The defensible second and third order names, all genuine community banks
under $400MM that most desks do not cover:
- Finward Bancorp (FNWD, about $160MM): an independent community bank on the
  net-interest-margin node, a classic consolidation target.
- First Internet Bancorp (INBK, about $243MM): small-business lending by a
  community bank, on the node about who gets squeezed as scale wins.
- Franklin Financial Services (FRAF, about $287MM): the fee-based banking
  node (wealth and insurance divisions), which is the "fee income" half of
  the thesis and the part most people ignore.

Just as useful for the pitch: the raw map also surfaced a water utility
(GWRS) and a business-process outsourcer (TASK) on peripheral phrase hits.
The engine labeled both "peripheral" exposure and flagged them on the
reality check, so they rank at the bottom, not the top. That is the honest
selling point to a skeptical PM: the tool ranks and flags candidates rather
than asserting them, and it shows its work on why the water utility does not
belong.

The gift email to a financials or event-driven fund: "You have written about
regional bank consolidation. The engine maps the fee-income second order to
Franklin Financial and the squeezed-target node to Finward, both under
$300MM, thin coverage, each traced to the bank's own filings. The three-node
excerpt is attached."

## Why this beats a normal cold email

A normal cold email asks for attention. This one spends the work first: you
did the analyst's job on their own thesis and handed them names with
citations. Time-to-first-value is zero because the value is in the message.
It is also unfakeable by a competitor who has not read their letter, which is
the swap test the voice rules demand.

## What to build to make this repeatable

The manual version works now, one firm at a time. To scale it to the whole ET
list without losing the personal quality:
1. 13F quarter-over-quarter diff per fund (parser exists; the diff report
   does not).
2. A prospect-map export: the three-node excerpt as one monochrome image with
   citations, sized for email. The gift artifact, generated in one click.
3. A "not in their 13F" filter on the candidate list, so the names surfaced
   are always ones they missed.
