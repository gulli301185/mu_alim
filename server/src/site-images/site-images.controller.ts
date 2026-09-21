import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { SiteImagesService, updateSiteImagesSchema } from './site-images.service';

@Controller()
export class SiteImagesController {
  constructor(private readonly siteImages: SiteImagesService) {}

  @Get('site-images')
  get() {
    return this.siteImages.get();
  }

  @Put('admin/site-images')
  @UseGuards(AdminGuard)
  update(
    @Body(new ZodPipe(updateSiteImagesSchema, { message: 'Сүрөт URL маалыматы туура эмес' }))
    body: z.infer<typeof updateSiteImagesSchema>,
  ) {
    return this.siteImages.update(body.images);
  }
}
