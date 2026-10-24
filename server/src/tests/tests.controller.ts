import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';
import {
  AdminGuard,
  AuthUser,
  CurrentUser,
  JwtAuthGuard,
  OptionalAuthGuard,
  assertUserRole,
} from '../common/auth';
import { AppError } from '../common/app-error';
import { ZodPipe } from '../common/zod.pipe';
import { CoursesService } from '../courses/courses.service';
import { toStudentGradeResult } from './tests.helpers';
import { TestsService } from './tests.service';
import { createTestSchema, gradeSchema, updateTestSchema } from './tests.schemas';

const testBody = { message: 'Маалымат туура эмес' };

/** Final exams exist only for paid courses. A course that is not found is left to the service. */
const isFreeCourse = (course: { courseType: string } | null) => course !== null && course.courseType !== 'paid';

@Controller()
export class TestsController {
  constructor(
    private readonly tests: TestsService,
    private readonly courses: CoursesService,
  ) {}

  @Get('admin/tests')
  @UseGuards(AdminGuard)
  adminList(@Query('course') course?: unknown) {
    return this.tests.adminList(typeof course === 'string' ? course.trim() || undefined : undefined);
  }

  @Get('admin/tests/:id')
  @UseGuards(AdminGuard)
  adminGet(@Param('id') id: string) {
    return this.tests.adminGet(id);
  }

  @Post('admin/tests')
  @UseGuards(AdminGuard)
  async adminCreate(@Body(new ZodPipe(createTestSchema, testBody)) body: z.infer<typeof createTestSchema>) {
    if (isFreeCourse(await this.courses.resolveRef(body.courseRef))) {
      throw new AppError(400, 'Бекер курска курстук тест түзүлбөйт');
    }
    return this.tests.adminCreate(body);
  }

  @Put('admin/tests/:id')
  @UseGuards(AdminGuard)
  adminUpdate(
    @Param('id') id: string,
    @Body(new ZodPipe(updateTestSchema, testBody)) body: z.infer<typeof updateTestSchema>,
  ) {
    return this.tests.adminUpdate(id, body);
  }

  @Delete('admin/tests/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async adminDelete(@Param('id') id: string) {
    await this.tests.adminDelete(id);
  }

  @Get('courses/:courseRef/final-test')
  @UseGuards(OptionalAuthGuard)
  async finalTest(@Param('courseRef') ref: string, @CurrentUser() user: AuthUser | undefined) {
    if (isFreeCourse(await this.courses.resolveRef(ref))) throw new AppError(404, 'Тест табылган жок');
    return this.tests.getFinalTest(ref, user);
  }

  @Post('courses/:courseRef/final-test/grade')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async grade(
    @Param('courseRef') ref: string,
    @CurrentUser() user: AuthUser | undefined,
    @Body(new ZodPipe(gradeSchema, testBody)) body: z.infer<typeof gradeSchema>,
  ) {
    assertUserRole(user);
    if (isFreeCourse(await this.courses.resolveRef(ref))) throw new AppError(404, 'Тест табылган жок');
    return toStudentGradeResult(await this.tests.gradeFinalTest(ref, user, body.answers));
  }
}
