import { CONFIG } from '../config.js';

// Fetch a news article and reduce it to readable text for scenario extraction.
// Plain fetch with a browser-ish user agent; many publishers block obvious bots,
// and when they do the caller gets an honest error rather than a silent empty run.

const MAX_CHARS = 14_000;

export async function fetchArticleText(rawUrl: string): Promise<{ title: string; text: string; url: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('That does not look like a valid link.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only http and https links are supported.');
  }

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) research reader; contact ' + CONFIG.userAgent,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`The site would not serve the article (HTTP ${res.status}). Paste the scenario as text instead.`);
  }
  const html = await res.text();

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();

  const cleanP = (s: string) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#8217;|&rsquo;/g, "'")
      .replace(/&#\d+;|&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Paragraphs with their byte offsets. The story body is the DENSEST
  // CONTIGUOUS cluster of paragraphs, not the first ones in the document: on
  // large news pages (AP is ~900KB) the body sits hundreds of KB in, after
  // navigation, newsletters, and teasers, and naive first-N extraction reads
  // the chrome instead of the story. That failure fed a tariff article's page
  // furniture to the model, which then invented the missing numbers.
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => ({ at: m.index ?? 0, text: cleanP(m[1]) }))
    .filter((p) => p.text.length > 60);

  // Fast path: a known body container (AP RichTextStoryBody, common
  // article-body class names). Take paragraphs after its position.
  const container = html.search(/RichTextStoryBody|article-body|story-body|ArticleBody|post-content|entry-content/);

  let picked: string[] = [];
  if (container > -1) {
    picked = paras.filter((p) => p.at >= container).map((p) => p.text);
  }
  if (picked.join('\n').length < 800) {
    // Cluster: split paragraph list where the HTML gap between consecutive
    // paragraphs exceeds 8KB (bodies are contiguous; chrome is scattered),
    // then keep the cluster with the most text.
    const clusters: Array<{ text: string[]; total: number }> = [];
    let cur: string[] = [];
    let total = 0;
    for (let i = 0; i < paras.length; i++) {
      if (i > 0 && paras[i].at - paras[i - 1].at > 8_000 && cur.length) {
        clusters.push({ text: cur, total });
        cur = [];
        total = 0;
      }
      cur.push(paras[i].text);
      total += paras[i].text.length;
    }
    if (cur.length) clusters.push({ text: cur, total });
    clusters.sort((a, b) => b.total - a.total);
    picked = clusters[0]?.text ?? [];
  }

  let text = picked.join('\n');
  if (text.length < 400) {
    // paragraph-sparse page: fall back to stripping the whole body
    text = html
      .replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (text.length < 300) {
    throw new Error('Could not extract readable article text from that page. Paste the scenario as text instead.');
  }
  return { title, text: text.slice(0, MAX_CHARS), url: url.toString() };
}
