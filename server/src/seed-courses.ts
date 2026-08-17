import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();

const PAID_COURSES = [
  { slug: 'family', title: 'Үй-бүлөлүк бакыт', price: 4500 },
  { slug: 'tasawuf', title: 'Тасауф илими', price: 4000 },
  { slug: 'fiqh', title: 'Фикх', price: 3800 },
  { slug: 'aqida', title: 'Акыйда', price: 3500 },
  { slug: 'basics', title: 'Ислам негиздери', price: 3200 },
  { slug: 'quran', title: 'Куран окуу', price: 3600 },
  { slug: 'sunnah', title: 'Сүннөт негиздери', price: 3400 },
  { slug: 'dua', title: 'Дубалар', price: 2800 },
  { slug: 'ramadan', title: 'Рамазан даярдыгы', price: 3000 },
  { slug: 'kids', title: 'Балдар тарбиясы', price: 3300 },
  { slug: 'akhlaq', title: 'Адеп-ахлак', price: 3100 },
  { slug: 'zakat', title: 'Зекет жана садака', price: 2900 },
] as const;

const DEMO_LESSONS = [
  {
    slug: 'family',
    title: '1-сабак: Киришүү',
    description: 'Бirinchi sabak',
    youtubeUrl: 'https://www.youtube.com/watch?v=jJ1V_5E1Khk',
    youtubeVideoId: 'jJ1V_5E1Khk',
    lessonOrder: 1,
    durationSeconds: 615,
  },
  {
    slug: 'family',
    title: '2-сабак: Улантуу',
    description: 'Ekinchi sabak',
    youtubeUrl: 'https://youtu.be/BIVXaQC1Lck',
    youtubeVideoId: 'BIVXaQC1Lck',
    lessonOrder: 2,
    durationSeconds: 580,
  },
] as const;

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'paid-courses' },
    update: { name: 'Акы төлөнүүчү курстар', isActive: true },
    create: {
      name: 'Акы төлөнүүчү курстар',
      slug: 'paid-courses',
      description: 'Муалим академиясынын акы төлөнүүчү курстары',
      isActive: true,
    },
  });

  for (const course of PAID_COURSES) {
    await prisma.course.upsert({
      where: { slug: course.slug },
      update: {
        title: course.title,
        price: course.price,
        isPublished: true,
        publishedAt: new Date(),
      },
      create: {
        categoryId: category.id,
        title: course.title,
        slug: course.slug,
        description: `${course.title} — онлайн видео курс.`,
        courseType: 'paid',
        price: course.price,
        currency: 'KGS',
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  for (const lesson of DEMO_LESSONS) {
    const course = await prisma.course.findUnique({ where: { slug: lesson.slug } });
    if (!course) continue;

    const existing = await prisma.lesson.findFirst({
      where: { courseId: course.id, lessonOrder: lesson.lessonOrder },
    });

    if (existing) {
      await prisma.lesson.update({
        where: { id: existing.id },
        data: {
          title: lesson.title,
          description: lesson.description,
          youtubeUrl: lesson.youtubeUrl,
          youtubeVideoId: lesson.youtubeVideoId,
          durationSeconds: lesson.durationSeconds,
          isPublished: true,
        },
      });
    } else {
      await prisma.lesson.create({
        data: {
          courseId: course.id,
          title: lesson.title,
          description: lesson.description,
          youtubeUrl: lesson.youtubeUrl,
          youtubeVideoId: lesson.youtubeVideoId,
          durationSeconds: lesson.durationSeconds,
          lessonOrder: lesson.lessonOrder,
          isPublished: true,
        },
      });
    }
  }

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
