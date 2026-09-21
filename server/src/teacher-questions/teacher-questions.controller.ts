import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard, AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import {
  TeacherQuestionsService,
  adminListQuerySchema,
  publishSchema,
  submitSchema,
} from './teacher-questions.service';

@Controller()
export class TeacherQuestionsController {
  constructor(private readonly questions: TeacherQuestionsService) {}

  @Get('teacher-questions/next-number')
  nextNumber() {
    return this.questions.nextNumber();
  }

  @Post('teacher-questions')
  submit(@Body(new ZodPipe(submitSchema, { firstIssue: true })) body: z.infer<typeof submitSchema>) {
    return this.questions.submit(body);
  }

  @Get('admin/teacher-questions')
  @UseGuards(AdminGuard)
  adminList(
    @Query(new ZodPipe(adminListQuerySchema, { message: 'Сурам туура эмес' }))
    query: z.infer<typeof adminListQuerySchema>,
  ) {
    return this.questions.adminList(query);
  }

  @Post('admin/teacher-questions/:id/publish')
  @UseGuards(AdminGuard)
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(publishSchema, { firstIssue: true })) body: z.infer<typeof publishSchema>,
  ) {
    return this.questions.publish(id, body.answer, user.id);
  }
}
