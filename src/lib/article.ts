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

  // Prefer paragraph content: it skips navigation, cookie banners, and footers.
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;|&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((t) => t.length > 60);

  let text = paragraphs.join('\n');
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
