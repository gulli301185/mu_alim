const API_BASE = import.meta.env.VITE_API_URL ?? '';

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
  skyImageUrl: '/sky-hero.jpg',
  bannerImageUrl: '/tunduk-hero.jpg',
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

export async function fetchHeroBanner(): Promise<HeroBanner> {
  const res = await fetch(`${API_BASE}/api/hero`);
  if (!res.ok) throw new Error(await readError(res, 'Баннер жүктөлгөн жок'));
  return res.json() as Promise<HeroBanner>;
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
