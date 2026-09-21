import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/zod.pipe';
import { PRAYER_REGIONS } from '../lib/prayer-regions';
import { PrayerService } from './prayer.service';

const timesQuerySchema = z.object({
  region: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

@Controller('prayer')
export class PrayerController {
  constructor(private readonly prayer: PrayerService) {}

  @Get('regions')
  @Header('Cache-Control', 'public, max-age=86400')
  regions() {
    return {
      items: PRAYER_REGIONS.map(({ id, name }) => ({ id, name })),
      defaultRegionId: 'bishkek',
    };
  }

  @Get('times')
  async times(
    @Query(new ZodPipe(timesQuerySchema, { message: 'Маалымат туура эмес' }))
    query: z.infer<typeof timesQuerySchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const payload = await this.prayer.getTimes(query.region, query.date);
      res.set('Cache-Control', 'public, max-age=300');
      return payload;
    } catch (err) {
      if (err instanceof Error && err.message === 'REGION_NOT_FOUND') {
        throw new AppError(404, 'Аймак табылган жок');
      }
      throw new AppError(502, 'Намаз убакыттарын алуу ийгиликсиз');
    }
  }
}
