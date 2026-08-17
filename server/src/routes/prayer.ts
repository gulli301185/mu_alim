import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { PRAYER_REGIONS } from '../lib/prayer-regions.js';
import { getPrayerTimes } from '../lib/prayer-service.js';

export const prayerRouter = Router();

prayerRouter.get(
  '/regions',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({
      items: PRAYER_REGIONS.map(({ id, name }) => ({ id, name })),
      defaultRegionId: 'bishkek',
    });
  }),
);

prayerRouter.get(
  '/times',
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({
        region: z.string().min(1),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    try {
      const payload = await getPrayerTimes(parsed.data.region, parsed.data.date);
      res.set('Cache-Control', 'public, max-age=300');
      res.json(payload);
    } catch (err) {
      if (err instanceof Error && err.message === 'REGION_NOT_FOUND') {
        res.status(404).json({ error: 'Аймак табылган жок' });
        return;
      }
      res.status(502).json({ error: 'Намаз убакыттарын алуу ийгиликсиз' });
    }
  }),
);
