import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { AdminGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import {
  AdminUsersService,
  grantEnrollmentSchema,
  listQuerySchema,
  statusSchema,
} from './admin-users.service';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query(new ZodPipe(listQuerySchema, { message: 'Жараксыз параметрлер' }))
    query: z.infer<typeof listQuerySchema>,
  ) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post(':id/enrollments')
  async grantEnrollment(
    @Param('id') id: string,
    @Body(new ZodPipe(grantEnrollmentSchema, { message: 'Курс тандоо керек' }))
    body: z.infer<typeof grantEnrollmentSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.grantEnrollment(id, body.courseId);
    res.status(result.alreadyActive ? 200 : 201);
    return result;
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body(new ZodPipe(statusSchema, { message: 'Жараксыз маалымат' })) body: z.infer<typeof statusSchema>,
  ) {
    return this.users.setStatus(id, body.isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
