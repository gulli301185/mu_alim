import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { HeroService, updateHeroSchema } from './hero.service';

@Controller()
export class HeroController {
  constructor(private readonly hero: HeroService) {}

  @Get('hero')
  get() {
    return this.hero.get();
  }

  @Put('admin/hero')
  @UseGuards(AdminGuard)
  update(
    @Body(new ZodPipe(updateHeroSchema, { message: 'Текст жана сүрөт URL керек' }))
    body: z.infer<typeof updateHeroSchema>,
  ) {
    return this.hero.update(body);
  }
}
