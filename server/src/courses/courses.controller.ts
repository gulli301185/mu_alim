import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import {
  CoursesService,
  createCourseSchema,
  importPlaylistSchema,
  listQuerySchema,
  updateCourseSchema,
} from './courses.service';

const listQuery = new ZodPipe(listQuerySchema, { message: 'Жараксыз параметрлер' });
const courseBody = { message: 'Маалымат туура эмес' };

@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get('free-lessons')
  freeLessons() {
    return this.courses.freeLessons();
  }

  @Get('courses')
  list(@Query(listQuery) query: z.infer<typeof listQuerySchema>) {
    return this.courses.listPublic(query);
  }

  @Get('courses/:courseRef')
  detail(@Param('courseRef') ref: string) {
    return this.courses.getPublic(ref);
  }

  @Get('admin/courses')
  @UseGuards(AdminGuard)
  adminList(@Query(listQuery) query: z.infer<typeof listQuerySchema>) {
    return this.courses.adminList(query);
  }

  @Post('admin/courses')
  @UseGuards(AdminGuard)
  adminCreate(@Body(new ZodPipe(createCourseSchema, courseBody)) body: z.infer<typeof createCourseSchema>) {
    return this.courses.adminCreate(body);
  }

  @Get('admin/courses/:courseRef')
  @UseGuards(AdminGuard)
  adminGet(@Param('courseRef') ref: string) {
    return this.courses.adminGet(ref);
  }

  @Put('admin/courses/:courseRef')
  @UseGuards(AdminGuard)
  adminUpdate(
    @Param('courseRef') ref: string,
    @Body(new ZodPipe(updateCourseSchema, courseBody)) body: z.infer<typeof updateCourseSchema>,
  ) {
    return this.courses.adminUpdate(ref, body);
  }

  @Delete('admin/courses/:courseRef')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async adminDelete(@Param('courseRef') ref: string) {
    await this.courses.adminDelete(ref);
  }

  @Get('admin/courses/:courseRef/lessons')
  @UseGuards(AdminGuard)
  adminLessons(@Param('courseRef') ref: string) {
    return this.courses.adminLessons(ref);
  }

  @Post('admin/courses/:courseRef/lessons/from-playlist')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  importPlaylist(
    @Param('courseRef') ref: string,
    @Body(new ZodPipe(importPlaylistSchema, { message: 'Плейлист шилтемеси туура эмес' }))
    body: z.infer<typeof importPlaylistSchema>,
  ) {
    return this.courses.importPlaylist(ref, body);
  }
}
