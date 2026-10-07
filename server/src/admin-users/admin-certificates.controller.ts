import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { AdminUsersService, listQuerySchema } from './admin-users.service';

@Controller('admin/certificates')
@UseGuards(AdminGuard)
export class AdminCertificatesController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(
    @Query(new ZodPipe(listQuerySchema, { message: 'Жараксыз параметрлер' }))
    query: z.infer<typeof listQuerySchema>,
  ) {
    return this.users.listCertificates(query);
  }
}
