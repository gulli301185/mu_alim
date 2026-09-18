import { API_BASE, assetUrl } from './asset-url';

export type HeroBanner = {
  title: string;
  subtitle: string;
  name: string;
  skyImageUrl: string;
  bannerImageUrl: string;
  updatedAt?: string;
};

export const DEFAULT_HERO: HeroBanner = {
  title: 'Бийиктикке умтул!',
  subtitle: 'Билим эркиндикке жол ачат, амал ийгиликке жеткирет.',
  name: 'Мухаммадалим',
  skyImageUrl: '/uploads/sky-hero.jpg',
  bannerImageUrl: '/uploads/tunduk-hero.jpg',
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

export async function fetchHeroBanner(): Promise<HeroBanner> {
  const res = await fetch(`${API_BASE}/api/hero`);
  if (!res.ok) throw new Error(await readError(res, 'Баннер жүктөлгөн жок'));
  const data = (await res.json()) as HeroBanner;
  return {
    ...data,
    skyImageUrl: assetUrl(data.skyImageUrl, DEFAULT_HERO.skyImageUrl),
    bannerImageUrl: assetUrl(data.bannerImageUrl, DEFAULT_HERO.bannerImageUrl),
  };
}

export async function updateHeroBanner(
  token: string,
  input: Omit<HeroBanner, 'updatedAt'>,
): Promise<HeroBanner> {
  const res = await fetch(`${API_BASE}/api/admin/hero`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, 'Баннер сакталган жок'));
  return res.json() as Promise<HeroBanner>;
}

export { assetUrl };
