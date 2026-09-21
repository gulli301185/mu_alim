import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../cache/cache.service';
import { DEFAULT_SITE_IMAGES } from '../data/site-images';
import { PrismaService } from '../prisma/prisma.service';

const HERO_ID = 'default';
const CACHE_KEY = 'site:hero';
const CACHE_TTL = 3600;

export const DEFAULT_HERO = {
  title: 'Бийиктикке умтул!',
  subtitle: 'Билим эркиндикке жол ачат, амал ийгиликке жеткирет.',
  name: 'Мухаммадалим',
  skyImageUrl: DEFAULT_SITE_IMAGES['hero.sky'],
  bannerImageUrl: DEFAULT_SITE_IMAGES['hero.banner'],
};

export const updateHeroSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(150),
  skyImageUrl: z.string().trim().min(1).max(500),
  bannerImageUrl: z.string().trim().min(1).max(500),
});

function toDto(row: {
  title: string;
  subtitle: string;
  name: string;
  skyImageUrl: string;
  bannerImageUrl: string;
  updatedAt: Date;
}) {
  return {
    title: row.title,
    subtitle: row.subtitle,
    name: row.name,
    skyImageUrl: row.skyImageUrl,
    bannerImageUrl: row.bannerImageUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class HeroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  get() {
    return this.cache.wrap(CACHE_KEY, CACHE_TTL, async () => {
      const hero = await this.prisma.heroBanner.upsert({
        where: { id: HERO_ID },
        update: {},
        create: { id: HERO_ID, ...DEFAULT_HERO },
      });
      return toDto(hero);
    });
  }

  async update(data: z.infer<typeof updateHeroSchema>) {
    const hero = await this.prisma.heroBanner.upsert({
      where: { id: HERO_ID },
      update: data,
      create: { id: HERO_ID, ...data },
    });

    await this.cache.del(CACHE_KEY);
    return toDto(hero);
  }
}
