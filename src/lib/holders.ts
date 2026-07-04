import { CONFIG } from '../config.js';
import { docUrl, fetchDocText, submissions } from './edgar.js';
import type { StakeDisclosure } from '../types.js';

// Significant-holder disclosures on the subject company's own feed. 13D means
// the holder reserves the right to push for change; 13G is a passive stake.
// EDGAR has both legacy names (SC 13D) and the newer ones (SCHEDULE 13D).
const HOLDER_FORMS = /^(SC 13[DG](\/A)?|SCHEDULE 13[DG](\/A)?)$/;

function parseCover(text: string): { holder: string | null; percent: number | null } {
  // Cover page layout: "NAMES OF REPORTING PERSONS" then the name; percent under
  // "PERCENT OF CLASS REPRESENTED". Layouts vary; take the nearest plausible token.
  const nameM = text.match(/NAMES? OF REPORTING PERSONS?[:\s]*(?:\(.*?\))?\s*([A-Z][A-Za-z0-9 .,&'-]{2,60}?)(?:\s{2,}|\s+(?:2|CHECK|SEC USE))/i);
  const pctM = text.match(/PERCENT OF CLASS[\s\S]{0,220}?([\d.]+)\s*%/i);
  const percent = pctM ? Number(pctM[1]) : null;
  return {
    holder: nameM ? nameM[1].trim() : null,
    percent: percent !== null && Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : null,
  };
}

export async function stakeDisclosures(cik: string): Promise<StakeDisclosure[]> {
  const subs = await submissions(cik);
  const r = subs.recent;
  const cutoff = new Date(Date.now() - CONFIG.evidence.holdersMonths * 30 * 86400_000).toISOString().slice(0, 10);

  const picked: Array<{ i: number; form: string }> = [];
  for (let i = 0; i < r.form.length && picked.length < CONFIG.evidence.holdersMax; i++) {
    if (HOLDER_FORMS.test(r.form[i]) && r.filingDate[i] >= cutoff) picked.push({ i, form: r.form[i] });
  }

  const out: StakeDisclosure[] = [];
  for (const { i, form } of picked) {
    const url = docUrl(cik, r.accessionNumber[i], r.primaryDocument[i]);
    let holder: string | null = null;
    let percent: number | null = null;
    try {
      const text = await fetchDocText(cik, r.accessionNumber[i], r.primaryDocument[i]);
      ({ holder, percent } = parseCover(text.slice(0, 30_000)));
    } catch {
      // keep the disclosure with a link even when the cover page resists parsing
    }
    out.push({
      form,
      activist: form.includes('13D'),
      holder,
      percent,
      filedAt: r.filingDate[i],
      url,
    });
  }
  // Newest first, one row per holder (amendments supersede originals).
  out.sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  const seen = new Set<string>();
  return out.filter((d) => {
    const k = d.holder ?? d.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
