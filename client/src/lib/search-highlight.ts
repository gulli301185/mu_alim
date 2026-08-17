import { createElement, Fragment, type ReactNode } from 'react';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getHighlightTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = new Set<string>();
  for (const raw of trimmed.split(/\s+/)) {
    const cleaned = raw.replace(/^№/, '').replace(/^суроо\s*/iu, '').trim();
    if (cleaned.length >= 2 && !/^\d+$/.test(cleaned)) {
      terms.add(cleaned);
    }
  }

  return [...terms];
}

export function highlightText(text: string, query: string): ReactNode {
  const terms = getHighlightTerms(query);
  if (!terms.length) return text;

  let parts: ReactNode[] = [text];

  for (const term of terms) {
    const re = new RegExp(`(${escapeRegex(term)})`, 'giu');
    parts = parts.flatMap((part, partIndex) => {
      if (typeof part !== 'string') return [part];

      return part.split(re).map((chunk, chunkIndex) => {
        if (!chunk) return null;
        if (chunkIndex % 2 === 1) {
          return createElement(
            'mark',
            { key: `${term}-${partIndex}-${chunkIndex}`, className: 'qa-search-hit' },
            chunk,
          );
        }
        return chunk;
      }).filter(Boolean);
    });
  }

  return createElement(Fragment, null, ...parts);
}
