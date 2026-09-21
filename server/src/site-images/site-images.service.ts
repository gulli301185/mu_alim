import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../cache/cache.service';
import { DEFAULT_SITE_IMAGES, SITE_IMAGE_KEYS, type SiteImageKey } from '../data/site-images';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteImage } from '../database/entities';

const CACHE_KEY = 'site:images';
const CACHE_TTL = 3600;

export const updateSiteImagesSchema = z.object({
  images: z.record(z.string().trim().min(1).max(500)),
});

function toMap(rows: { key: string; url: string }[]) {
  const images: Record<string, string> = { ...DEFAULT_SITE_IMAGES };
  for (const row of rows) {
    images[row.key] = row.url;
  }
  return images;
}

@Injectable()
export class SiteImagesService {
  constructor(
    @InjectRepository(SiteImage) private readonly images: Repository<SiteImage>,
    private readonly cache: CacheService,
  ) {}

  private async ensureSiteImages() {
    const rows = await this.images.find();
    const existing = new Set(rows.map((row) => row.key));
    const missing = (Object.keys(DEFAULT_SITE_IMAGES) as SiteImageKey[]).filter(
      (key) => !existing.has(key),
    );

    if (missing.length === 0) return rows;

    const now = new Date();
    await this.images
      .createQueryBuilder()
      .insert()
      .values(missing.map((key) => ({ key, url: DEFAULT_SITE_IMAGES[key], createdAt: now, updatedAt: now })))
      .orIgnore()
      .execute();

    return this.images.find();
  }

  get() {
    return this.cache.wrap(CACHE_KEY, CACHE_TTL, async () => ({
      images: toMap(await this.ensureSiteImages()),
    }));
  }

  async update(images: Record<string, string>) {
    const entries = Object.entries(images).filter(([key]) =>
      Object.values(SITE_IMAGE_KEYS).includes(key as SiteImageKey),
    );

    const now = new Date();
    if (entries.length > 0) {
      await this.images
        .createQueryBuilder()
        .insert()
        .values(entries.map(([key, url]) => ({ key, url, createdAt: now, updatedAt: now })))
        .orUpdate(['url', 'updated_at'], ['key'])
        .execute();
    }

    await this.cache.del(CACHE_KEY);
    return { images: toMap(await this.images.find()) };
  }
}
