export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnail(
  videoId: string,
  quality: "default" | "hq" = "hq",
): string {
  return quality === "hq"
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.hostname.includes("youtu.be")) {
      return parts[0] || null;
    }

    const v = url.searchParams.get("v");
    if (v) return v;

    const segmentMap = ["shorts", "embed", "video", "live"];
    for (const segment of segmentMap) {
      const index = parts.indexOf(segment);
      if (index >= 0 && parts[index + 1]) return parts[index + 1];
    }
  } catch {
    return null;
  }

  return null;
}
