// Hermes: the offline filing reader. It runs through filings once and writes a
// structured card per company, so scenario runs query a pre-read corpus instead
// of gambling on exact-phrase search wording at query time.

// Controlled tag vocabulary. Free-form tags fragment the corpus into synonyms
// ("robotics" vs "robots" vs "automation"), so extraction must pick from this
// list; genuinely new themes go through 'other:<term>' and get promoted here
// when they recur. Arguable and versioned on purpose.
export const TAG_VOCABULARY = [
  'ai-compute',
  'data-centers',
  'edge-ai',
  'semiconductors',
  'semi-equipment',
  'robotics',
  'industrial-automation',
  'warehouse-automation',
  'machine-vision',
  'sensors',
  'precision-motion',
  'rare-earths',
  'battery-storage',
  'grid-equipment',
  'transmission',
  'utilities',
  'nuclear',
  'renewables',
  'oil-gas-services',
  'mining-materials',
  'specialty-chemicals',
  'electrical-steel',
  'copper-aluminum',
  'defense',
  'space',
  'cybersecurity',
  'quantum',
  'biotech-therapeutics',
  'medical-devices',
  'diagnostics',
  'digital-health',
  'fintech',
  'insurance',
  'staffing-labor',
  'logistics',
  'construction-eng',
  'housing',
  'agriculture',
  'consumer-brands',
  'ecommerce',
  'gaming-media',
  'telecom-networking',
  'satellites',
  'evs-mobility',
  'aerospace-suppliers',
] as const;

export type Stance = 'core_product' | 'active_investment' | 'risk_mention';

// Windows reserves CON, PRN, AUX, NUL, COM1-9, LPT1-9 (case-insensitive, any
// extension); a ticker that collides yields a file git cannot even stat. The
// index key stays the real ticker; only the on-disk filename is prefixed.
const RESERVED = new Set(
  ['CON', 'PRN', 'AUX', 'NUL']
    .concat(Array.from({ length: 9 }, (_, i) => 'COM' + (i + 1)))
    .concat(Array.from({ length: 9 }, (_, i) => 'LPT' + (i + 1))),
);
export function cardFilename(ticker: string): string {
  return (RESERVED.has(ticker.toUpperCase()) ? '_' + ticker : ticker) + '.json';
}

export interface Exposure {
  tag: string; // from TAG_VOCABULARY, or 'other:<term>'
  stance: Stance;
  sentence: string; // exact filing sentence, the audit trail
}

export interface CompanyCard {
  cik: string;
  ticker: string;
  name: string;
  source: { form: string; accession: string; filedAt: string; url: string };
  // What the company actually sells and to whom, 2 to 3 sentences.
  business: string;
  sellsTo: string[]; // end markets and customer types
  namedCustomers: string[];
  namedSuppliers: string[];
  exposures: Exposure[];
  catalysts: { event: string; date: string | null; sentence: string }[];
  tamClaims: { claim: string; sentence: string }[];
  generatedAt: string;
  model: string;
}
