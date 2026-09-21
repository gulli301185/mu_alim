import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard, assertUserRole } from '../common/auth';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../database/entities';

@Controller()
export class EnrollmentsController {
  constructor(@InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>) {}

  @Get('me/enrollments')
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser() user: AuthUser | undefined) {
    assertUserRole(user);

    const enrollments = await this.enrollments.find({
      where: { userId: user.id, status: 'active' },
      order: { enrolledAt: 'DESC' },
      relations: { course: true },
    });

    return {
      items: enrollments.map((item) => ({
        id: item.id,
        status: item.status,
        enrolledAt: item.enrolledAt.toISOString(),
        courseId: item.course.id,
        courseSlug: item.course.slug,
        courseTitle: item.course.title,
        courseType: item.course.courseType,
      })),
    };
  }
}
