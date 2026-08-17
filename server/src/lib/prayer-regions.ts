export type PrayerRegion = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

/** Кыргызстан шаarlary жана облустары */
export const PRAYER_REGIONS: PrayerRegion[] = [
  { id: 'bishkek', name: 'Бишкек', latitude: 42.8746, longitude: 74.5698 },
  { id: 'osh', name: 'Ош', latitude: 40.5283, longitude: 72.7985 },
  { id: 'jalal-abad', name: 'Жалал-Абад', latitude: 40.9333, longitude: 73.0 },
  { id: 'karakol', name: 'Каракол', latitude: 42.4907, longitude: 78.3936 },
  { id: 'talas', name: 'Талас', latitude: 42.5228, longitude: 72.2427 },
  { id: 'naryn', name: 'Нарын', latitude: 41.4283, longitude: 75.9911 },
  { id: 'batken', name: 'Баткен', latitude: 40.0626, longitude: 70.8194 },
  { id: 'kara-balta', name: 'Кара-Балта', latitude: 42.8142, longitude: 73.8481 },
  { id: 'tokmok', name: 'Токмок', latitude: 42.8417, longitude: 75.3014 },
  { id: 'kant', name: 'Кант', latitude: 42.8911, longitude: 74.8508 },
  { id: 'kyzyl-kiya', name: 'Кызыл-Кыя', latitude: 40.2569, longitude: 72.1283 },
  { id: 'isfana', name: 'Исфана', latitude: 39.8389, longitude: 69.5278 },
];

export function getPrayerRegion(id: string): PrayerRegion | undefined {
  return PRAYER_REGIONS.find((region) => region.id === id);
}
