import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import getRawBody from 'raw-body';
import type { Request } from 'express';
import type { z } from 'zod';
import { AdminGuard, AuthUser, CurrentUser, JwtAuthGuard, OptionalAuthGuard } from '../common/auth';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/zod.pipe';
import {
  ReviewsService,
  adminCreateSchema,
  adminListQuerySchema,
  adminUpdateSchema,
  createReviewSchema,
  listQuerySchema,
} from './reviews.service';

const VIDEO_UPLOAD_DIR = resolve(__dirname, '../../uploads/reviews');
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.webm', '.mov']);

const listQuery = new ZodPipe(listQuerySchema, { message: 'Сурам туура эмес' });
const adminListQuery = new ZodPipe(adminListQuerySchema, { message: 'Сурам туура эмес' });

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reviews')
  list(@Query(listQuery) query: z.infer<typeof listQuerySchema>) {
    return this.reviews.listPublic(query);
  }

  @Get('courses/:ref/reviews')
  @UseGuards(OptionalAuthGuard)
  listForCourse(
    @Param('ref') ref: string,
    @Query(listQuery) query: z.infer<typeof listQuerySchema>,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.reviews.listForCourse(ref, query, user);
  }

  @Post('courses/:ref/reviews')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('ref') ref: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createReviewSchema, { message: 'Рейтинг 1–5 болушу керек' }))
    body: z.infer<typeof createReviewSchema>,
  ) {
    return this.reviews.create(ref, user, body);
  }

  @Get('admin/reviews')
  @UseGuards(AdminGuard)
  adminList(@Query(adminListQuery) query: z.infer<typeof adminListQuerySchema>) {
    return this.reviews.adminList(query);
  }

  /** Raw video bytes in the request body; the admin guard runs before the stream is read. */
  @Post('admin/reviews/upload-video')
  @UseGuards(AdminGuard)
  async uploadVideo(@Req() req: Request, @Headers('x-file-name') fileName?: string) {
    const ext = extname(String(fileName || 'review.mp4')).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) throw new AppError(400, 'mp4, m4v, webm же mov видео керек');

    let buffer: Buffer;
    try {
      buffer = await getRawBody(req, { limit: '80mb' });
    } catch {
      throw new AppError(413, 'Видео файлы өтө чоң');
    }
    if (!buffer.length) throw new AppError(400, 'Видео файлы бош');

    await mkdir(VIDEO_UPLOAD_DIR, { recursive: true });
    const stored = `${randomUUID()}${ext}`;
    await writeFile(resolve(VIDEO_UPLOAD_DIR, stored), buffer);
    return { url: `/uploads/reviews/${stored}` };
  }

  @Post('admin/reviews')
  @UseGuards(AdminGuard)
  adminCreate(
    @CurrentUser() user: AuthUser,
    @Body(
      new ZodPipe(adminCreateSchema, {
        message: 'Курс, отзыв жазган адамдын аты жана текст же видео керек',
      }),
    )
    body: z.infer<typeof adminCreateSchema>,
  ) {
    return this.reviews.adminCreate(user, body);
  }

  @Patch('admin/reviews/:id')
  @UseGuards(AdminGuard)
  adminUpdate(
    @Param('id') id: string,
    @Body(new ZodPipe(adminUpdateSchema, { message: 'Маалымат туура эмес' }))
    body: z.infer<typeof adminUpdateSchema>,
  ) {
    return this.reviews.adminUpdate(id, body);
  }

  @Delete('admin/reviews/:id')
  @UseGuards(AdminGuard)
  adminDelete(@Param('id') id: string) {
    return this.reviews.adminDelete(id);
  }
}
