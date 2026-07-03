# design.md: Corollary

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

Repalette decided 2026-07-03 at Russ's direction (full change away from the
original ink-and-gold). The register is bioelectric: a deep petrol dark, near
the color of a lights-off lab, with one living signal color. Nothing else
competes with the signal.

- `--bg`: `#061417` (page, deep petrol)
- `--surface`: `#0B2226` (panels)
- `--surface-raised`: `#0F2A2F` (cards inside panels)
- `--border`: `#16363B` (hairline, 1px everywhere)
- `--border-strong`: `#235057`
- `--text`: `#ECF3E8` (primary; warm pale, never pure white)
- `--text-muted`: `#93A9A0`
- `--text-faint`: `#56716B`
- `--accent`: `#C6F24E` (the one accent, solid fill only, never gradient).
  Bioelectric lime: the color of a synapse firing, the moment a connection is
  made. Used for: the primary CTA fill, the firing neurons and cascade strokes
  in the hero field, one emphasized word in the headline, link underlines.
  Never for large fills or backgrounds.
- `--accent-hover`: `#D4F96F`
- `--accent-on`: `#061417` (text on accent fill)

Data-encoding colors (product surfaces only, not the marketing hero). These
are not the brand accent; they encode a real polarity in the product and are
exempt from the one-accent rule for that reason only. Muted on purpose:
- `--beneficiary`: `#4E9B6F` / tint at 12% fill / border at 32%
- `--at-risk`: `#C1595A` / tint at 10% fill / border at 32%

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

Inside the app and on document surfaces, nothing animates on loop and nothing
animates without a state change (page load counts as one state change,
scroll-into-view counts as one, hover and focus count, nothing else does).

One deliberate exception, decided 2026-07-03: the landing hero carries an
ambient field (see Effects) that runs continuously and responds to the
cursor. It is the only looping and only cursor-reactive motion in the brand,
it exists only on the marketing hero, and it must stay calm: staggered
cadence, alpha-based brightness, flat color, no strobing. It pauses when the
tab is hidden and renders a static composition under prefers-reduced-motion.

Load choreography (marketing pages): content reveals once, on load, as a
staged sequence: each block fades up 20px with `settle` over 800ms, staggered
in 80 to 120ms increments in reading order (nav, kicker, headline lines,
supporting copy, CTA). Nothing re-triggers.

## Effects

One signature effect, revised again 2026-07-03 at Russ's direction: the
abstract flat field was not enough; the image should be the brain itself,
three dimensional, registering the aha moment. **The cortex.**

The hero carries a procedurally generated brain: a point cloud sampled on
the surface of two wrinkled hemisphere ellipsoids with a longitudinal
fissure between them, a flattened base, and a cerebellum mass at the lower
rear. No mesh asset, no 3D library: the cloud is rotated and perspective
projected in plain canvas 2D. It turns slowly on its vertical axis and
answers the cursor with a slight parallax tilt, which is what sells the
three dimensionality.

Its life:
1. At rest the brain is a calm, dim structure. Depth cues come from per
   point size and alpha only (nearer points larger and brighter).
2. Local cascades course across the cortex continuously: a neuron fires
   (full `--accent`, size ticks up, decays over a second), igniting up to 3
   surface neighbors per generation (about 110ms per beat), lime strokes
   jumping along each connection and fading.
3. Every 8 to 11 seconds, the aha: one deep cascade plus a spherical
   wavefront that sweeps the entire structure from the origin point,
   briefly lifting every neuron it passes. The whole brain registers the
   thought, then settles.
4. Cursor movement (or touch) excites the nearest neuron into a small
   cascade, rate limited so deliberate mousing plays the instrument without
   strobing.

Rendering rules: flat strokes and fills only. No shadowBlur, no gradients,
no bloom; brightness is alpha. The brain sits in the open ground of the
composition (upper right on desktop, upper center on mobile), never behind
the headline. Canvas pauses when the tab is hidden; under
prefers-reduced-motion it renders one static rotated brain with a completed
cascade instead of animating.

A second, quieter display treatment belongs to the brand: the hollow
headline line. One line of the hero headline renders as stroke-only type
(1.5px text stroke in `--text` at 90%, transparent fill). It reads as the
consequence not yet filled in. Use at 60px and above only.

No other motion effect is used on this page. No parallax, no scroll-jacking,
no blur, no glow, no gradient mesh.

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
