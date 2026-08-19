import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  DEMO_PAID_LESSONS,
  FREE_COURSE,
  FREE_VIDEOS_SEED,
  PAID_COURSES_SEED,
  parseDurationToSeconds,
} from './data/course-seed-data.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();

async function upsertCategory(slug: string, name: string, description: string) {
  return prisma.category.upsert({
    where: { slug },
    update: { name, description, isActive: true },
    create: { slug, name, description, isActive: true },
  });
}

async function seedFreeCourse(freeCategoryId: string) {
  const course = await prisma.course.upsert({
    where: { slug: FREE_COURSE.slug },
    update: {
      title: FREE_COURSE.title,
      description: FREE_COURSE.description,
      courseType: 'free',
      price: 0,
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      categoryId: freeCategoryId,
      title: FREE_COURSE.title,
      slug: FREE_COURSE.slug,
      description: FREE_COURSE.description,
      courseType: 'free',
      price: 0,
      currency: 'KGS',
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  for (const [index, video] of FREE_VIDEOS_SEED.entries()) {
    const lessonOrder = index + 1;
    const existing = await prisma.lesson.findFirst({
      where: { courseId: course.id, lessonOrder },
    });
    const durationSeconds = parseDurationToSeconds(video.duration);

    const data = {
      title: video.title,
      description: `Бекер баян · ${video.date ?? ''}`.trim(),
      youtubeUrl: video.url,
      youtubeVideoId: video.videoId,
      durationSeconds,
      isPublished: true,
    };

    if (existing) {
      await prisma.lesson.update({ where: { id: existing.id }, data });
    } else {
      await prisma.lesson.create({
        data: { courseId: course.id, lessonOrder, ...data },
      });
    }
  }

  console.log(`✓ Free course: ${course.title} (${FREE_VIDEOS_SEED.length} lessons)`);
}

async function seedPaidCourses(paidCategoryId: string) {
  for (const courseSeed of PAID_COURSES_SEED) {
    const course = await prisma.course.upsert({
      where: { slug: courseSeed.slug },
      update: {
        title: courseSeed.title,
        price: courseSeed.price,
        isPublished: true,
        publishedAt: new Date(),
      },
      create: {
        categoryId: paidCategoryId,
        title: courseSeed.title,
        slug: courseSeed.slug,
        description: `${courseSeed.title} — онлайн видео курс.`,
        courseType: 'paid',
        price: courseSeed.price,
        currency: 'KGS',
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    const introSeconds = parseDurationToSeconds(courseSeed.intro.duration);
    const introExisting = await prisma.lesson.findFirst({
      where: { courseId: course.id, lessonOrder: 1 },
    });

    const introData = {
      title: courseSeed.intro.title,
      description: `${courseSeed.title} — киришүү`,
      youtubeUrl: courseSeed.intro.url,
      youtubeVideoId: courseSeed.intro.videoId,
      durationSeconds: introSeconds,
      isPublished: true,
    };

    if (introExisting) {
      await prisma.lesson.update({ where: { id: introExisting.id }, data: introData });
    } else {
      await prisma.lesson.create({
        data: { courseId: course.id, lessonOrder: 1, ...introData },
      });
    }
  }

  console.log(`✓ Paid courses: ${PAID_COURSES_SEED.length}`);
}

async function seedDemoPaidLessons() {
  for (const lesson of DEMO_PAID_LESSONS) {
    const course = await prisma.course.findUnique({ where: { slug: lesson.slug } });
    if (!course) continue;

    const existing = await prisma.lesson.findFirst({
      where: { courseId: course.id, lessonOrder: lesson.lessonOrder },
    });

    const data = {
      title: lesson.title,
      description: lesson.description,
      youtubeUrl: lesson.youtubeUrl,
      youtubeVideoId: lesson.youtubeVideoId,
      durationSeconds: lesson.durationSeconds,
      isPublished: true,
    };

    if (existing) {
      await prisma.lesson.update({ where: { id: existing.id }, data });
    } else {
      await prisma.lesson.create({
        data: { courseId: course.id, lessonOrder: lesson.lessonOrder, ...data },
      });
    }
  }
}

async function main() {
  const freeCategory = await upsertCategory(
    'free-courses',
    'Бекер курстар',
    'Бекер видео баяндар жана сабактар',
  );
  const paidCategory = await upsertCategory(
    'paid-courses',
    'Акы төлөнүүчү курстар',
    'Муалим академиясынын акы төлөнүүчү курстары',
  );

  await seedFreeCourse(freeCategory.id);
  await seedPaidCourses(paidCategory.id);
  await seedDemoPaidLessons();

  const courseCount = await prisma.course.count();
  const lessonCount = await prisma.lesson.count();
  console.log(`Courses seeded: ${courseCount}, lessons: ${lessonCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
