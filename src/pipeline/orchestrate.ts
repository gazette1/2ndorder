import { decompose } from './decompose.js';
import { draftTheses } from './draft.js';
import { enrich } from './enrich.js';
import { mapTickers } from './map.js';
import { readFilings } from './read.js';
import { score } from './score.js';

// The full pipeline for one run, in order. Used by the CLI "all" stage and by the
// API server when a search has no cached run. Each stage persists its output to
// data/runs/<slug>, so a failure can be resumed from the last completed stage.
export async function runAll(slug: string, seed: string): Promise<void> {
  await decompose(slug, seed);
  await mapTickers(slug);
  await enrich(slug);
  await readFilings(slug);
  await score(slug);
  await draftTheses(slug);
}
