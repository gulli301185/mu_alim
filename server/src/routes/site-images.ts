import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  DEFAULT_SITE_IMAGES,
  SITE_IMAGE_KEYS,
  type SiteImageKey,
} from '../data/site-images.js';

export const siteImagesRouter = Router();

const updateSchema = z.object({
  images: z.record(z.string().trim().min(1).max(500)),
});

async function ensureSiteImages() {
  const rows = await prisma.siteImage.findMany();
  const existing = new Set(rows.map((row) => row.key));
  const missing = (Object.keys(DEFAULT_SITE_IMAGES) as SiteImageKey[]).filter(
    (key) => !existing.has(key),
  );

  if (missing.length === 0) return rows;

  await prisma.siteImage.createMany({
    data: missing.map((key) => ({
      key,
      url: DEFAULT_SITE_IMAGES[key],
    })),
    skipDuplicates: true,
  });

  return prisma.siteImage.findMany();
}

function toMap(rows: { key: string; url: string }[]) {
  const images: Record<string, string> = { ...DEFAULT_SITE_IMAGES };
  for (const row of rows) {
    images[row.key] = row.url;
  }
  return images;
}

siteImagesRouter.get(
  '/site-images',
  asyncHandler(async (_req, res) => {
    const rows = await ensureSiteImages();
    res.json({ images: toMap(rows) });
  }),
);

siteImagesRouter.put(
  '/admin/site-images',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Сүрөт URL маалыматы туура эмес' });
      return;
    }

    const entries = Object.entries(parsed.data.images).filter(([key]) =>
      Object.values(SITE_IMAGE_KEYS).includes(key as SiteImageKey),
    );

    await Promise.all(
      entries.map(([key, url]) =>
        prisma.siteImage.upsert({
          where: { key },
          update: { url },
          create: { key, url },
        }),
      ),
    );

    const rows = await prisma.siteImage.findMany();
    res.json({ images: toMap(rows) });
  }),
);
