import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../cache/cache.service';
import { DEFAULT_SITE_IMAGES } from '../data/site-images';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeroBanner } from '../database/entities';

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
    @InjectRepository(HeroBanner) private readonly heroes: Repository<HeroBanner>,
    private readonly cache: CacheService,
  ) {}

  /** Atomic insert-or-update of the single banner row; `overwrite` lists the columns to refresh on conflict. */
  private upsert(values: z.infer<typeof updateHeroSchema>, overwrite: string[]) {
    const now = new Date();
    const insert = this.heroes
      .createQueryBuilder()
      .insert()
      .values({ id: HERO_ID, ...values, createdAt: now, updatedAt: now });
    return overwrite.length > 0 ? insert.orUpdate(overwrite, ['id']).execute() : insert.orIgnore().execute();
  }

  get() {
    return this.cache.wrap(CACHE_KEY, CACHE_TTL, async () => {
      await this.upsert(DEFAULT_HERO, []);
      return toDto(await this.heroes.findOneByOrFail({ id: HERO_ID }));
    });
  }

  async update(data: z.infer<typeof updateHeroSchema>) {
    await this.upsert(data, ['title', 'subtitle', 'name', 'sky_image_url', 'banner_image_url', 'updated_at']);
    const hero = await this.heroes.findOneByOrFail({ id: HERO_ID });

    await this.cache.del(CACHE_KEY);
    return toDto(hero);
  }
}
