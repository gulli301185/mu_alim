import { getPrayerRegion } from './prayer-regions.js';

export type PrayerTimeItem = {
  key: string;
  name: string;
  time: string;
};

export type PrayerTimesPayload = {
  region: { id: string; name: string };
  date: string;
  timezone: string;
  times: PrayerTimeItem[];
  nextPrayer: { key: string; name: string; time: string; at: string } | null;
  activePrayer: { key: string; name: string; time: string } | null;
};

const TIMEZONE = 'Asia/Bishkek';
/** MWL + Hanafi (Кыргызстанда кеңири колдонулат) */
const CALC_METHOD = 3;
const CALC_SCHOOL = 1;

const PRAYER_LABELS: Record<string, string> = {
  Fajr: 'Фажр',
  Sunrise: 'Күн чыгыш',
  Dhuhr: 'Бешим',
  Asr: 'Аср',
  Maghrib: 'Шам',
  Isha: 'Куптан',
};

const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

type CacheEntry = { expiresAt: number; payload: PrayerTimesPayload };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function normalizeTime(raw: string): string {
  return raw.split(' ')[0].slice(0, 5);
}

function todayInTimezone(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseDateParts(isoDate: string): { day: string; month: string; year: string } {
  const [year, month, day] = isoDate.split('-');
  return { day, month, year };
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutesInTimezone(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function resolveNextAndActive(times: PrayerTimeItem[], isoDate: string) {
  const now = nowMinutesInTimezone();
  let activePrayer: PrayerTimeItem | null = null;
  let nextPrayer: PrayerTimeItem | null = null;
  let nextDate = isoDate;

  for (const prayer of times) {
    const mins = minutesOfDay(prayer.time);
    if (mins <= now) activePrayer = prayer;
    if (mins > now && !nextPrayer) nextPrayer = prayer;
  }

  if (!nextPrayer && times[0]) {
    nextPrayer = times[0];
    const [y, m, d] = isoDate.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    nextDate = tomorrow.toISOString().slice(0, 10);
  }

  const nextAt =
    nextPrayer != null ? `${nextDate}T${nextPrayer.time}:00+06:00` : null;

  return {
    activePrayer,
    nextPrayer:
      nextPrayer && nextAt
        ? { key: nextPrayer.key, name: nextPrayer.name, time: nextPrayer.time, at: nextAt }
        : null,
  };
}

async function fetchFromAladhan(regionId: string, isoDate: string): Promise<PrayerTimesPayload> {
  const region = getPrayerRegion(regionId);
  if (!region) {
    throw new Error('REGION_NOT_FOUND');
  }

  const { day, month, year } = parseDateParts(isoDate);
  const url = new URL(`https://api.aladhan.com/v1/timings/${day}-${month}-${year}`);
  url.searchParams.set('latitude', String(region.latitude));
  url.searchParams.set('longitude', String(region.longitude));
  url.searchParams.set('method', String(CALC_METHOD));
  url.searchParams.set('school', String(CALC_SCHOOL));
  url.searchParams.set('timezonestring', TIMEZONE);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('PRAYER_API_FAILED');
  }

  const body = (await res.json()) as {
    data?: { timings?: Record<string, string> };
  };

  const timings = body.data?.timings;
  if (!timings) {
    throw new Error('PRAYER_API_INVALID');
  }

  const times: PrayerTimeItem[] = PRAYER_ORDER.map((key) => ({
    key,
    name: PRAYER_LABELS[key],
    time: normalizeTime(timings[key] ?? '00:00'),
  }));

  const { activePrayer, nextPrayer } = resolveNextAndActive(times, isoDate);

  return {
    region: { id: region.id, name: region.name },
    date: isoDate,
    timezone: TIMEZONE,
    times,
    nextPrayer,
    activePrayer: activePrayer
      ? { key: activePrayer.key, name: activePrayer.name, time: activePrayer.time }
      : null,
  };
}

export async function getPrayerTimes(regionId: string, date?: string): Promise<PrayerTimesPayload> {
  const isoDate = date ?? todayInTimezone();
  const cacheKey = `${regionId}:${isoDate}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const payload = await fetchFromAladhan(regionId, isoDate);
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}
