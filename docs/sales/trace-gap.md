# TRACE against the current pipeline: what exists, what is missing

An honest inventory for the redesign, mapped stage by stage against the
framework (Trigger, Reactions, Aftereffects, Capture, Expectations). The raw
material for the rewrite is in pipeline-export.md (one real input, its
complete output, every prompt).

## Stage by stage

- **T, Trigger.** Partial. The seed is one free-text sentence; the decompose
  prompt does not force actor, magnitude, geography, effective date,
  certainty, duration, reversibility. The macro layer (FRED, FOMC) attaches
  context but nothing formalizes the trigger. Gap: a trigger-normalization
  step at the top of decompose.
- **R, Reactions.** Weakest link. The current node model is hop-based (one,
  two, three steps out), not behavior-based. Nothing asks "who is hurt by
  this and what will they do to stop it." Some emergent second-order nodes
  read like reactions (buyers substitute, developers face bottlenecks) but
  it is not enforced. Gap: the strategic-response pass, and redefining the
  orders as mechanical effect, incentivized response, new equilibrium.
- **A, Aftereffects.** Partial. whiteSpace flags nodes with logic but no
  filings; horizon (near, mid, long) approximates lags. No feedback loops,
  no bottleneck-migration reasoning, no explicit counterforces per edge.
- **C, Capture.** Strongest part, mostly built. The filing read verifies
  exposure against actual 10-K sentences with an exposure grade (direct,
  adjacent, peripheral); the reality check tests tradability and
  survivability (ADV, days-to-build, runway, dilution, shelf); the evidence
  layer adds insiders including Form 144, 13D/G holders, proxy, 8-K events,
  sector regulator. Missing from capture: segment-revenue weighting and
  pricing-power evidence; keyword-adjacency can still sneak a name in,
  which is exactly what the exposure grade demotes but does not eliminate.
- **E, Expectations.** Not built at all. Nothing compares the thesis to
  consensus, estimate revisions, valuation, or recent price reaction. The
  free stack for a first version: short interest (FINRA), estimate counts
  via the coverage seam, 13F crowding (already parsed), price reaction
  around the trigger date (delayed quotes suffice for direction). This is
  the largest single upgrade and the sharpest differentiation for a PM
  audience: it converts an observation into a candidate edge.

## The cross-cutting rules from the research, and their cost

- **KPI termination rule** (a branch must land on a measurable company KPI
  or stop): cheap, high value. One paragraph added to the decompose prompt
  plus a kpi field per node; kills third-order fiction at the source.
- **1-5 transparent bands instead of 0-100 composites**: cheap. The rubric
  already produces per-dimension subscores with rationales; the change is
  presentation and honest banding, not new machinery.
- **Adversarial pass**: half-built. The counter-scenario runs an entire
  disconfirming map automatically, which is stronger than most tools have.
  Missing: the per-thesis counterfactual ("would this outcome happen without
  the trigger") and the strongest-competing-explanation section.
- **Multi-pass architecture**: the pipeline is already multi-pass (evidence
  extraction, decompose, read, score, draft are separate model calls with
  disk artifacts between them), so the rewrite is a re-specification of
  passes, not a rescue from one giant prompt.
- **Audit object**: already aligned with the research's warning. What is
  auditable here is the cited causal graph, the saved prompts, and the
  filing sentences, not chain-of-thought prose. Keep it that way.

## Sequencing recommendation

Before Saturday: language and demo structure only (done in trowe-demo.md).
The pipeline that exists is coherent and demonstrable; a half-landed
rearchitecture two days before a live demo is how demos die.

After Saturday, in value order:
1. Expectations pass (new stage between score and draft).
2. Trigger normalization plus KPI termination in decompose.
3. Strategic-response pass and the order redefinition (mechanical,
   response, equilibrium).
4. Per-thesis counterfactual in the draft prompt.
5. Feedback and bottleneck pass.
