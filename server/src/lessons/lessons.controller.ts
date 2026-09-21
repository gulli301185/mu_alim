import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard, AuthUser, CurrentUser, OptionalAuthGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { LessonsService, createLessonSchema, updateLessonSchema } from './lessons.service';

const lessonBody = { message: 'Маалымат туура эмес' };

@Controller()
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get('courses/:courseId/lessons')
  @UseGuards(OptionalAuthGuard)
  list(@Param('courseId') courseId: string, @CurrentUser() user: AuthUser | undefined) {
    return this.lessons.listForCourse(courseId, user);
  }

  @Post('courses/:courseId/lessons')
  @UseGuards(AdminGuard)
  create(
    @Param('courseId') courseId: string,
    @Body(new ZodPipe(createLessonSchema, lessonBody)) body: z.infer<typeof createLessonSchema>,
  ) {
    return this.lessons.create(courseId, body);
  }

  @Put('lessons/:id')
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateLessonSchema, lessonBody)) body: z.infer<typeof updateLessonSchema>,
  ) {
    return this.lessons.update(id, body);
  }

  @Delete('lessons/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.lessons.remove(id);
  }
}
