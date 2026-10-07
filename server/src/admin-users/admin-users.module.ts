import { Module } from '@nestjs/common';
import { AdminCertificatesController } from './admin-certificates.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  controllers: [AdminUsersController, AdminCertificatesController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
