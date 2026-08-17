export function parseQuestionNumberSearch(query: string): number | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const explicit = trimmed.match(/^(?:суроо\s*)?№?\s*(\d+)$/iu);
  if (explicit) {
    const num = Number(explicit[1]);
    return Number.isInteger(num) && num > 0 ? num : null;
  }

  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isInteger(num) && num > 0 ? num : null;
  }

  return null;
}
