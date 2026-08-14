export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
) {
  let slug = slugify(base) || 'suroo';
  if (!(await exists(slug))) return slug;

  let n = 2;
  while (await exists(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}
