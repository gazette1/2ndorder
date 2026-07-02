import type { ReactNode } from 'react';

// Small hand-rolled markdown renderer.
// Supported: # and ## headings, paragraphs, - bullets, **bold**,
// [n] citation markers, and [text](url) links.

export interface MdBlock {
  kind: 'h1' | 'h2' | 'p' | 'ul';
  text: string;
  items?: string[];
}

export function parseBlocks(md: string): MdBlock[] {
  const lines = md.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let bullets: string[] | null = null;

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets && bullets.length > 0) {
      blocks.push({ kind: 'ul', text: bullets.join('\n'), items: bullets });
    }
    bullets = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (trimmed === '') {
      flushPara();
      flushBullets();
    } else if (trimmed.startsWith('## ')) {
      flushPara();
      flushBullets();
      blocks.push({ kind: 'h2', text: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      flushPara();
      flushBullets();
      blocks.push({ kind: 'h1', text: trimmed.slice(2) });
    } else if (trimmed.startsWith('- ')) {
      flushPara();
      if (!bullets) bullets = [];
      bullets.push(trimmed.slice(2));
    } else {
      flushBullets();
      para.push(trimmed);
    }
  }
  flushPara();
  flushBullets();
  return blocks;
}

// Inline tokens: **bold**, [n] citation (not followed by an open paren), [text](url) link.
const INLINE = /\*\*(.+?)\*\*|\[(\d+)\](?!\()|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function renderInline(
  text: string,
  keyPrefix: string,
  onCite: (n: number) => void,
  activeCite: number | null,
): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${keyPrefix}-b${i}`}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      const n = parseInt(m[2], 10);
      out.push(
        <button
          key={`${keyPrefix}-c${i}`}
          type="button"
          className={activeCite === n ? 'cite cite-active' : 'cite'}
          onClick={() => onCite(n)}
          title="Show cited passage"
        >
          [{n}]
        </button>,
      );
    } else if (m[3] !== undefined && m[4] !== undefined) {
      out.push(
        <a key={`${keyPrefix}-a${i}`} href={m[4]} target="_blank" rel="noopener noreferrer">
          {m[3]}
        </a>,
      );
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function blockContainsCite(block: MdBlock, n: number | null): boolean {
  if (n === null) return false;
  return block.text.includes(`[${n}]`);
}
