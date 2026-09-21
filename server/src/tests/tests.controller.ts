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
import { ZodPipe } from '../common/zod.pipe';
import { TestsService } from './tests.service';
import { createTestSchema, gradeSchema, updateTestSchema } from './tests.schemas';

const testBody = { message: 'Маалымат туура эмес' };

@Controller()
export class TestsController {
  constructor(private readonly tests: TestsService) {}

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
  adminCreate(@Body(new ZodPipe(createTestSchema, testBody)) body: z.infer<typeof createTestSchema>) {
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
  finalTest(@Param('courseRef') ref: string, @CurrentUser() user: AuthUser | undefined) {
    return this.tests.getFinalTest(ref, user);
  }

  @Post('courses/:courseRef/final-test/grade')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  grade(
    @Param('courseRef') ref: string,
    @CurrentUser() user: AuthUser | undefined,
    @Body(new ZodPipe(gradeSchema, testBody)) body: z.infer<typeof gradeSchema>,
  ) {
    assertUserRole(user);
    return this.tests.gradeFinalTest(ref, user, body.answers);
  }
}
