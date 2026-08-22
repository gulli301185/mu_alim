import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';

export const heroRouter = Router();

const HERO_ID = 'default';

export const DEFAULT_HERO = {
  title: 'Бийиктикке умтул!',
  subtitle: 'Билим эркиндикке жол ачат, амал ийгиликке жеткирет.',
  name: 'Мухаммадалим',
  skyImageUrl: '/sky-hero.jpg',
  bannerImageUrl: '/tunduk-hero.jpg',
};

const updateSchema = z.object({
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

async function getOrCreateHero() {
  return prisma.heroBanner.upsert({
    where: { id: HERO_ID },
    update: {},
    create: { id: HERO_ID, ...DEFAULT_HERO },
  });
}

heroRouter.get(
  '/hero',
  asyncHandler(async (_req, res) => {
    const hero = await getOrCreateHero();
    res.json(toDto(hero));
  }),
);

heroRouter.put(
  '/admin/hero',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Текст жана сүрөт URL керек' });
      return;
    }

    const hero = await prisma.heroBanner.upsert({
      where: { id: HERO_ID },
      update: parsed.data,
      create: { id: HERO_ID, ...parsed.data },
    });

    res.json(toDto(hero));
  }),
);
