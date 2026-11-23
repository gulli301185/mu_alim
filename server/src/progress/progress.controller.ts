import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { UserThrottlerGuard } from '../common/user-throttler.guard';
import { ProgressService } from './progress.service';

@Controller('courses/:courseId/progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  get(@CurrentUser() user: AuthUser | undefined, @Param('courseId') courseId: string) {
    return this.progress.get(user, courseId);
  }

  /** At most 5 lessons per minute per user (QA H-2 phase 1.5); slows scripted completion. */
  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
