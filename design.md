# design.md — Corollary

Brand system for corollaryresearch.com and the Corollary application. This is
the first design.md for this product; it governs the landing page and should
be ported, not reinvented, when the same identity moves into the app shell,
the IC memo export, or any future deck.

## Identity

Corollary reads what the market has not read yet and shows the reasoning in
the open. It is not a chat app, not a dashboard of charts, not a "disruption"
pitch. It is closer to a research journal crossed with an instrument panel:
quiet, exact, willing to show its work. Every visual choice should say "we
read the primary source and can point to the sentence," not "trust the AI."
Restraint is the flex. The one moment of drama is the mechanic itself, made
visible: a scenario, and what follows from it, drawn in front of you.

## Typography

- Display (headlines, editorial moments): `Newsreader`, variable serif,
  optical sizing on. Weight 400 for headline body, 500 for the wordmark,
  italic reserved for single-word emphasis only. Reads like a journal
  masthead, ties directly to "primary source, close reading."
- UI and body: `IBM Plex Sans`, weights 400 / 500 / 600. Built for technical
  products; carries the "instrument" half of the identity.
- Data, tickers, citation markers, mono labels: `IBM Plex Mono`, weight 400 /
  500. Anything that is a fact, a count, or a symbol goes in mono.
- Never: Inter, Roboto, Arial, Space Grotesk (house rule, hard constraint).
- Type scale (px, 16 base, hand-tuned, not a mechanical ratio):
  13 / 15 / 16 / 19 / 23 / 29 / 38 / 52 / 72
- Tracking: body 0. Mono labels and the kicker get +0.04em. Never tighten
  tracking on the display serif; it is already dense at large sizes.
- Line height: display 1.08 at 52px+, 1.2 at 29-38px. Body 1.6. Mono labels
  1.0, single line only.

## Color

Ink, not charcoal. Cooler and darker than a generic "dark mode" gray.

- `--bg`: `#0B0D10` (page)
- `--surface`: `#14171B` (panels, the diagram canvas)
- `--surface-raised`: `#191D22` (cards inside panels)
- `--border`: `#262B31` (hairline, 1px everywhere)
- `--border-strong`: `#363D46`
- `--text`: `#EDEFF2` (primary; never pure white on this background)
- `--text-muted`: `#9AA1AB`
- `--text-faint`: `#5C636D`
- `--accent`: `#D9A441` (the one accent, solid fill only, never gradient).
  Warm gold, reads as highlighter ink on a filing, the mark of a sourced
  claim. Used for: the primary CTA fill, link underlines, the citation glyph,
  one hairline rule per section. Never for large fills or backgrounds.
- `--accent-on`: `#0B0D10` (text on accent fill)

Data-encoding colors. These are not the brand accent; they encode a real
polarity in the product and are exempt from the one-accent rule for that
reason only. Muted on purpose, never traffic-light saturated:
- `--beneficiary`: `#4E9B6F` / tint `#4E9B6F1A` (12% fill) / border `#4E9B6F52`
- `--at-risk`: `#C1595A` / tint `#C1595A1A` / border `#C1595A52`

## Spacing

Base unit 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
Section padding on desktop: 96px top/bottom, 64px sides, clamps down on
mobile via `clamp()`, never a fixed breakpoint jump.

## Motion

Named curve `settle`: `cubic-bezier(0.16, 1, 0.3, 1)`. Used for anything that
arrives (node reveal, panel entrance). Never used for hover (hover uses
linear, 120ms, because a hover response should feel immediate, not eased).

Durations: `fast` 120ms (hover, focus), `base` 400ms (panel/section reveal),
`draw` 900ms (the hero diagram's line-draw sequence, staggered per tier, see
Effects).

Nothing animates on loop. Nothing animates without a state change (page
load counts as one state change, scroll-into-view counts as one, hover and
focus count, nothing else does).

## Effects

One signature effect, chosen because it performs the product's mechanic
rather than decorating the page: **the corollary tree draws itself.**

On load, the scenario statement is already on screen. Then, tier by tier
(order 1, then order 2, then order 3), thin connecting strokes draw from
parent to child using `stroke-dasharray` / `stroke-dashoffset` animation
(the classic "line draws itself" SVG technique), 900ms per tier with a
150ms stagger between sibling nodes, eased with `settle`. Each node's card
fades and settles into place as its connecting stroke completes, never
before. The effect is the argument: a scenario, and what follows from it,
being derived in front of you rather than pasted in as a screenshot.

No other motion effect is used on this page. No parallax, no scroll-jacking,
no particles, no blur, no glow, no gradient mesh.

## Components

- **Primary button**: solid `--accent` fill, `--accent-on` text, weight 600,
  radius 3px, no shadow. Hover: fill lightens 8% (no glow, no scale). Height
  44px, horizontal padding 20px.
- **Ghost / secondary button**: transparent fill, 1px `--border-strong`,
  `--text` color, radius 3px. Hover: border becomes `--accent`, nothing else
  moves.
- **Input** (scenario field): `--surface-raised` fill, 1px `--border`,
  `IBM Plex Mono` text, radius 3px. Focus: 1px `--accent` border, no ring,
  no blur.
- **Map node card**: radius 6px, 1px border in the polarity color at 32%
  opacity, background tint at 10% opacity of the same polarity color, label
  in `IBM Plex Mono` 13px, count line in `--text-faint` 13px mono.
- **Panel / diagram canvas**: `--surface`, radius 12px, 1px `--border`.
- Radius scale in use: 0 (hairlines, dividers) / 3px (controls) / 6px (map
  nodes) / 12px (panels). Never the same radius on every element.

## Voice

Plain, factual, declarative. No em-dash. No exclamation points. No
superlatives ("best," "revolutionary," "game-changing"). No buzzword padding
(leverage, unlock, harness, empower, seamless, elevate). Describe the
mechanism, not the adjective: say what the product does, not how good it is.
Every line should fail the swap test for a generic AI-fintech competitor,
meaning it should be specific enough that a competitor could not honestly
reuse it verbatim. Do not fabricate results, customer names, or performance
numbers; anything illustrative on the page is labeled as illustrative.

## Anti-patterns

Explicitly not this brand:
- No gradients anywhere (fills, text, buttons, backgrounds), including
  purple-to-blue.
- No glassmorphism or frosted-blur cards.
- No glowing orbs, blurred blobs, or particle fields.
- No centered hero followed by a 3-column icon-in-circle feature grid.
- No pastel icon-in-rounded-square feature list (the "lucide in a circle"
  pattern).
- No uniform border-radius across every element (pill-everything).
- No stock shadcn/Tailwind-default look (default indigo buttons, default
  gray-100 cards).
- No fabricated logo wall, "trusted by" row, testimonials, user counts, or
  countdown timers. There is no customer base yet; do not imply one.
- No em-dash, no exclamation points, no superlatives, anywhere, including
  inside SVG text.
- No rocket, lightbulb, or sparkle iconography. No emoji.
- No loop animation. Nothing moves without a reason tied to a state change.
