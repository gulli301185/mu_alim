export function parseYoutubePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^(PL|UU|FL|LL|RD|OL)[\w-]{10,}$/i.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const list = url.searchParams.get('list');
    if (list?.trim()) return list.trim();
  } catch {
    return null;
  }

  return null;
}

export type PlaylistVideo = {
  title: string;
  videoId: string;
  youtubeUrl: string;
  durationSeconds: number | null;
};

function extractText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';
  const rec = value as Record<string, unknown>;
  if (typeof rec.content === 'string') return rec.content.trim();
  if (typeof rec.simpleText === 'string') return rec.simpleText.trim();
  if (Array.isArray(rec.runs)) {
    return rec.runs
      .map((run) => (run && typeof run === 'object' && 'text' in run ? String(run.text ?? '') : ''))
      .join('')
      .trim();
  }
  return '';
}

function parseDurationToSeconds(value: string): number | null {
  const parts = value.split(':').map((part) => Number(part.trim()));
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function pushVideo(out: PlaylistVideo[], videoId: string, title: string, durationText: string) {
  if (!/^[\w-]{11}$/.test(videoId)) return;
  if (out.some((item) => item.videoId === videoId)) return;
  out.push({
    title: (title || `Сабак ${out.length + 1}`).slice(0, 255),
    videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    durationSeconds: parseDurationToSeconds(durationText),
  });
}

function collectVideos(node: unknown, out: PlaylistVideo[]) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideos(item, out);
    return;
  }

  const rec = node as Record<string, unknown>;
  const classic = rec.playlistVideoRenderer as Record<string, unknown> | undefined;
  if (classic && typeof classic.videoId === 'string') {
    pushVideo(out, classic.videoId, extractText(classic.title), extractText(classic.lengthText));
    return;
  }

  const lockup = rec.lockupViewModel as Record<string, unknown> | undefined;
  if (lockup && typeof lockup.contentId === 'string') {
    const metadata = lockup.metadata as Record<string, unknown> | undefined;
    const metaModel = metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined;
    const durationParts: string[] = [];
    collectDurationText(lockup.contentImage, durationParts);
    pushVideo(out, lockup.contentId, extractText(metaModel?.title), durationParts[0] ?? '');
    return;
  }

  for (const value of Object.values(rec)) collectVideos(value, out);
}

function collectDurationText(node: unknown, out: string[]) {
  if (out.length > 0 || !node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectDurationText(item, out);
    return;
  }
  const rec = node as Record<string, unknown>;
  const badge = rec.thumbnailBadgeViewModel as Record<string, unknown> | undefined;
  if (badge && typeof badge.text === 'string' && badge.text.includes(':')) {
    out.push(badge.text);
    return;
  }
  for (const value of Object.values(rec)) collectDurationText(value, out);
}

function collectContinuations(node: unknown, out: string[]) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectContinuations(item, out);
    return;
  }

  const rec = node as Record<string, unknown>;
  const continuation = rec.continuationItemRenderer as Record<string, unknown> | undefined;
  const endpoint = continuation?.continuationEndpoint as Record<string, unknown> | undefined;
  const command = endpoint?.continuationCommand as Record<string, unknown> | undefined;
  if (typeof command?.token === 'string' && !out.includes(command.token)) {
    out.push(command.token);
    return;
  }

  for (const value of Object.values(rec)) collectContinuations(value, out);
}

async function innertubeBrowse(body: Record<string, unknown>) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'ky,ru;q=0.8,en;q=0.6',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240815.00.00',
          hl: 'ky',
          gl: 'KG',
        },
      },
      ...body,
    }),
  });

  if (!res.ok) return null;

  return res.json() as Promise<unknown>;
}

async function fetchPlaylistHtml(playlistId: string): Promise<unknown | null> {
  const res = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept-Language': 'ky,ru;q=0.8,en;q=0.6',
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const marker = 'ytInitialData = ';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf(';</script>', jsonStart);
  if (jsonEnd < 0) return null;
  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd)) as unknown;
  } catch {
    return null;
  }
}

export async function fetchYoutubePlaylistVideos(playlistUrl: string): Promise<PlaylistVideo[]> {
  const playlistId = parseYoutubePlaylistId(playlistUrl);
  if (!playlistId) {
    throw new Error('YouTube плейлист шилтемеси туура эмес');
  }

  const videos: PlaylistVideo[] = [];
  const seenTokens = new Set<string>();
  let data: unknown =
    (await innertubeBrowse({
      browseId: playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`,
    })) ?? (await fetchPlaylistHtml(playlistId));
  collectVideos(data, videos);

  if (videos.length === 0) {
    const htmlData = await fetchPlaylistHtml(playlistId);
    if (htmlData) {
      data = htmlData;
      collectVideos(data, videos);
    }
  }

  for (let page = 0; page < 20 && videos.length > 0; page += 1) {
    const tokens: string[] = [];
    collectContinuations(data, tokens);
    const token = tokens.find((item) => !seenTokens.has(item));
    if (!token) break;
    seenTokens.add(token);
    const next = await innertubeBrowse({ continuation: token });
    if (!next) break;
    data = next;
    collectVideos(data, videos);
  }

  if (videos.length === 0) {
    throw new Error('Плейлистте видео табылган жок. Шилтеме ачык же unlisted болушу керек.');
  }

  return videos;
}
