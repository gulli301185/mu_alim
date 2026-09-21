import type { DataSource } from 'typeorm';
import { connectScriptDb, upsertBy } from './database/data-source';
import { Category, Course, Lesson } from './database/entities';
import {
  AKHLAQ_LESSONS,
  DEMO_PAID_LESSONS,
  FREE_COURSE,
  FREE_VIDEOS_SEED,
  PAID_COURSES_SEED,
  parseDurationToSeconds,
} from './data/course-seed-data.js';

let ds: DataSource;

/** Insert or update the lesson at `lessonOrder` of a course. */
async function upsertLesson(
  courseId: string,
  lessonOrder: number,
  data: Partial<Lesson> & Pick<Lesson, 'title' | 'youtubeUrl' | 'youtubeVideoId'>,
) {
  const repo = ds.getRepository(Lesson);
  const existing = await repo.findOneBy({ courseId, lessonOrder });
  if (existing) {
    await repo.save(Object.assign(existing, data));
  } else {
    await repo.save(repo.create({ description: null, durationSeconds: null, courseId, lessonOrder, ...data }));
  }
}

async function upsertCategory(slug: string, name: string, description: string) {
  return upsertBy(
    ds,
    Category,
    { slug },
    { name, description, isActive: true },
    { slug, name, description, isActive: true },
  );
}

async function seedFreeCourse(freeCategoryId: string) {
  const course = await upsertBy(
    ds,
    Course,
    { slug: FREE_COURSE.slug },
    {
      title: FREE_COURSE.title,
      description: FREE_COURSE.description,
      courseType: 'free',
      price: 0,
      isPublished: true,
      publishedAt: new Date(),
    },
    {
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
  );

  for (const [index, video] of FREE_VIDEOS_SEED.entries()) {
    const lessonOrder = index + 1;
    const durationSeconds = parseDurationToSeconds(video.duration);

    await upsertLesson(course.id, lessonOrder, {
      title: video.title,
      description: `Бекер баян · ${video.date ?? ''}`.trim(),
      youtubeUrl: video.url,
      youtubeVideoId: video.videoId,
      durationSeconds,
      isPublished: true,
    });
  }

  console.log(`✓ Free course: ${course.title} (${FREE_VIDEOS_SEED.length} lessons)`);
}

async function seedPaidCourses(paidCategoryId: string) {
  for (const courseSeed of PAID_COURSES_SEED) {
    const course = await upsertBy(
      ds,
      Course,
      { slug: courseSeed.slug },
      {
        title: courseSeed.title,
        price: courseSeed.price,
        isPublished: true,
        publishedAt: new Date(),
      },
      {
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
    );

    const existingLessonCount = await ds.getRepository(Lesson).countBy({ courseId: course.id });
    if (existingLessonCount > 1) {
      continue;
    }

    const introSeconds = parseDurationToSeconds(courseSeed.intro.duration);

    await upsertLesson(course.id, 1, {
      title: courseSeed.intro.title,
      description: `${courseSeed.title} — киришүү`,
      youtubeUrl: courseSeed.intro.url,
      youtubeVideoId: courseSeed.intro.videoId,
      durationSeconds: introSeconds,
      isPublished: true,
    });
  }

  console.log(`✓ Paid courses: ${PAID_COURSES_SEED.length}`);
}

async function seedAkhlaqLessons() {
  const course = await ds.getRepository(Course).findOneBy({ slug: 'akhlaq' });
  if (!course) return;

  for (const [index, lesson] of AKHLAQ_LESSONS.entries()) {
    const lessonOrder = index + 1;
    await upsertLesson(course.id, lessonOrder, {
      title: lesson.title,
      description: 'Адеп-ахлак курсу · видео сабак',
      youtubeUrl: `https://www.youtube.com/watch?v=${lesson.videoId}`,
      youtubeVideoId: lesson.videoId,
      durationSeconds: parseDurationToSeconds(lesson.duration),
      isPublished: true,
    });
  }

  console.log(`✓ Akhlaq lessons: ${AKHLAQ_LESSONS.length}`);
}

async function seedDemoPaidLessons() {
  for (const lesson of DEMO_PAID_LESSONS) {
    const course = await ds.getRepository(Course).findOneBy({ slug: lesson.slug });
    if (!course) continue;

    await upsertLesson(course.id, lesson.lessonOrder, {
      title: lesson.title,
      description: lesson.description,
      youtubeUrl: lesson.youtubeUrl,
      youtubeVideoId: lesson.youtubeVideoId,
      durationSeconds: lesson.durationSeconds,
      isPublished: true,
    });
  }
}

async function main() {
  ds = await connectScriptDb();
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
  await seedAkhlaqLessons();
  await seedDemoPaidLessons();

  const courseCount = await ds.getRepository(Course).count();
  const lessonCount = await ds.getRepository(Lesson).count();
  console.log(`Courses seeded: ${courseCount}, lessons: ${lessonCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await ds?.destroy();
  });
