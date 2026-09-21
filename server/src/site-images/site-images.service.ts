import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../cache/cache.service';
import { DEFAULT_SITE_IMAGES, SITE_IMAGE_KEYS, type SiteImageKey } from '../data/site-images';
import { PrismaService } from '../prisma/prisma.service';

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
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async ensureSiteImages() {
    const rows = await this.prisma.siteImage.findMany();
    const existing = new Set(rows.map((row) => row.key));
    const missing = (Object.keys(DEFAULT_SITE_IMAGES) as SiteImageKey[]).filter(
      (key) => !existing.has(key),
    );

    if (missing.length === 0) return rows;

    await this.prisma.siteImage.createMany({
      data: missing.map((key) => ({ key, url: DEFAULT_SITE_IMAGES[key] })),
      skipDuplicates: true,
    });

    return this.prisma.siteImage.findMany();
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

    await Promise.all(
      entries.map(([key, url]) =>
        this.prisma.siteImage.upsert({
          where: { key },
          update: { url },
          create: { key, url },
        }),
      ),
    );

    await this.cache.del(CACHE_KEY);
    return { images: toMap(await this.prisma.siteImage.findMany()) };
  }
}
