# Firm map artifacts at scale

The Currie map, turned into an assembly line. Every firm can get a same-quality
branded consequence map as a private link. This is what scales and what does
not, and how to run it.

## What scales, and what stays manual

- **Scales (automated):** generating the branded map artifact from a run. The
  generator (scripts/make-map.py) turns any completed run into a self-contained
  HTML map, fonts inlined, identical in quality to the hand-built Currie page.
- **Stays manual (per firm):** two things. Researching the firm's real thesis
  so the scenario is worth running, and researching plus reaching the right
  person. Neither is automated across the list. Compiling individual contacts
  at scale is the personal-data line this project has held throughout, and a
  blast of auto-generated maps would send weak work under your name. The point
  of the artifact is craft; craft does not batch.

## The realistic shape

Not 848 maps. Your own funnel (gtm.md) is 154 screened, about 40 with a public
thesis worth mapping, roughly 12 sent per quarter. The artifacts scale to
hundreds cheaply; the human judgment in front of each one is the constraint,
and it should be. Work in tiers:

- **Tier A, thesis publishers.** Firms that post letters or essays (1 Main
  Capital, Bireme, Camelot Event-Driven, and others on targets-est.md). Read
  the actual thesis, tune the scenario to it, run, generate, send. Highest hit
  rate. Start here.
- **Tier B, 13F-delta firms.** The roughly 356 firms with a CIK. Their
  quarter-over-quarter position change is a thesis stated in holdings. Draft a
  scenario from the delta, review it before running (a mechanical scenario is
  often wrong), then generate.
- **Tier C, skip.** No public thesis, no readable 13F signal. A generic map is
  not a gift. Do not send one.

## The per-firm process

1. **Research the thesis.** The firm's site, latest letter, a podcast, or the
   13F delta. Reduce to one sentence: "[Firm] believes [X]."
2. **Run the scenario.** Cast the thesis as a scenario (thesis-to-idea.md),
   then run it:
   `OPENAI_API_KEY=... npx tsx -e "..."` or add a small run script. About
   five to fifteen minutes and a few cents per firm.
3. **Generate the map.** With an unguessable output name so the target list
   cannot be enumerated:
   `python scripts/make-map.py <run-slug> --out <firm>-<token> --firm "Firm" --why "one line on why this fits them"`
   The generator prints the names it selected and the full ranking. Read them.
   If the lead name is off-thesis or flagged, the map is not ready; fix the
   scenario, do not send it.
4. **Host it.** Deploy the site/ folder to Cloudflare Pages (below). The map is
   live at map.corollaryresearch.com/maps/<firm>-<token>.
5. **Send it.** Research the right person at the firm, one firm at a time, from
   public sources. Send the link with a short personal note (the Currie note in
   currie.md is the model). Never a bulk send, never a compiled list.

## Hosting at scale on Cloudflare Pages

One deploy hosts every map. You already have Cloudflare and the domain.

1. Cloudflare dashboard -> Workers and Pages -> Create -> Pages -> Upload
   assets. Drag the `site` folder. Deploy. You get a `*.pages.dev` URL.
2. In the Pages project -> Custom domains -> add `map.corollaryresearch.com`.
   The DNS wires itself since the domain is in your account.
3. To add firms later, generate new maps into site/maps/ and re-upload the
   folder (or connect the GitHub repo so a push redeploys the site/ directory).

Privacy: the maps root lists nothing, and each file carries a random token in
its name, so no one can enumerate who you are pitching. Keep it that way. Do
not publish an index of firms.

## The generator

`scripts/make-map.py <run-slug> [--out name] [--firm "Name"] [--why "line"]`

- Reads data/runs/<slug> and the corpus cards for filing sentences.
- Selects the two lead names by exposure quality first (direct over
  peripheral), then fewest reality flags, then score, so a high-scoring but
  flagged name does not lead.
- Writes site/maps/<out>.html, self-contained, ready to host or attach.
- Prints its selection so a human can veto a weak map before it goes out.

Samples generated from existing runs live in site/maps (pharma-reshoring,
grid-capex, humanoid). They show the output quality; they are not firm-specific
and are not for sending.
