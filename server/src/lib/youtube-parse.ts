export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.slice(1).split('/')[0] || null;
    }
    const v = url.searchParams.get('v');
    if (v) return v;
    const parts = url.pathname.split('/');
    const embedIndex = parts.indexOf('embed');
    if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    const videoIndex = parts.indexOf('video');
    if (videoIndex >= 0 && parts[videoIndex + 1]) return parts[videoIndex + 1];
  } catch {
    return null;
  }

  return null;
}
