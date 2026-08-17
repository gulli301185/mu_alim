export type PrayerRegion = {
  id: string;
  name: string;
};

export type PrayerTimeItem = {
  key: string;
  name: string;
  time: string;
};

export type PrayerTimesResponse = {
  region: PrayerRegion;
  date: string;
  timezone: string;
  times: PrayerTimeItem[];
  nextPrayer: { key: string; name: string; time: string; at: string } | null;
  activePrayer: { key: string; name: string; time: string } | null;
};

export type PrayerRegionsResponse = {
  items: PrayerRegion[];
  defaultRegionId: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const PRAYER_REGION_STORAGE_KEY = 'mualim-prayer-region';

async function parseApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function fetchPrayerRegions(): Promise<PrayerRegionsResponse> {
  const res = await fetch(`${API_BASE}/api/prayer/regions`);
  if (!res.ok) throw new Error(await parseApiError(res, 'Аймактарды жүктөө ийгиликсиз'));
  return res.json();
}

export async function fetchPrayerTimes(regionId: string): Promise<PrayerTimesResponse> {
  const query = new URLSearchParams({ region: regionId });
  const res = await fetch(`${API_BASE}/api/prayer/times?${query.toString()}`);
  if (!res.ok) throw new Error(await parseApiError(res, 'Намаз убакыттарын жүктөө ийгиликсиз'));
  return res.json();
}

export function loadSavedPrayerRegion(): string | null {
  try {
    return localStorage.getItem(PRAYER_REGION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function savePrayerRegion(regionId: string) {
  try {
    localStorage.setItem(PRAYER_REGION_STORAGE_KEY, regionId);
  } catch {
    /* ignore */
  }
}
