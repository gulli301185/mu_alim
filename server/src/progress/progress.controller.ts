import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { ProgressService } from './progress.service';

@Controller('courses/:courseId/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  get(@CurrentUser() user: AuthUser | undefined, @Param('courseId') courseId: string) {
    return this.progress.get(user, courseId);
  }

  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthUser | undefined,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.progress.completeLesson(user, courseId, lessonId);
  }

  @Post('sync')
  @HttpCode(200)
  sync(
    @CurrentUser() user: AuthUser | undefined,
    @Param('courseId') courseId: string,
    @Body() body: unknown,
  ) {
    return this.progress.sync(user, courseId, body);
  }

  @Post('certificate')
  @HttpCode(200)
  issueCertificate(
    @CurrentUser() user: AuthUser | undefined,
    @Param('courseId') courseId: string,
    @Body() body: { studentName?: string; certificateNumber?: string },
  ) {
    return this.progress.issueCertificate(user, courseId, body ?? {});
  }
}
