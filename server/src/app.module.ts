import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.service';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { HealthController } from './health/health.controller';
import { HeroModule } from './hero/hero.module';
import { LessonsModule } from './lessons/lessons.module';
import { MailModule } from './mail/mail.module';
import { PrayerModule } from './prayer/prayer.module';
import { PrismaModule } from './prisma/prisma.service';
import { ProgressModule } from './progress/progress.module';
import { QaModule } from './qa/qa.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SiteImagesModule } from './site-images/site-images.module';
import { TeacherQuestionsModule } from './teacher-questions/teacher-questions.module';
import { TestsModule } from './tests/tests.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    PrismaModule,
    CacheModule,
    MailModule,
    AuthModule,
    AdminUsersModule,
    CoursesModule,
    LessonsModule,
    EnrollmentsModule,
    ProgressModule,
    TestsModule,
    ReviewsModule,
    QaModule,
    TeacherQuestionsModule,
    PrayerModule,
    HeroModule,
    SiteImagesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
