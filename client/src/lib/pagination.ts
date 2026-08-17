export function getPaginationRange(current: number, total: number, windowSize = 7): number[] {
  if (total <= 0) return [];
  if (total <= windowSize) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, current - half);
  let end = start + windowSize - 1;

  if (end > total) {
    end = total;
    start = end - windowSize + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
