import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard, assertUserRole } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class EnrollmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me/enrollments')
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser() user: AuthUser | undefined) {
    assertUserRole(user);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: { select: { id: true, slug: true, title: true, courseType: true } },
      },
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
