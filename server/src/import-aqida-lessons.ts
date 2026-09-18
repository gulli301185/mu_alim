import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();

const COURSE_SLUG = 'aqida';
const EXPECTED_COUNT = 45;
const TITLE_RE = /^(\d+)-(\d+)-сабак$/;

type ProgressFile = {
  uploaded?: Record<string, { title?: string; video_id?: string }>;
};

function parseLessonTitle(title: string) {
  const match = title.trim().match(TITLE_RE);
  if (!match) return null;
  return { tepkich: Number(match[1]), sabak: Number(match[2]) };
}

async function main() {
  const progressPath = resolve(process.argv[2] ?? `${process.env.HOME ?? ''}/Downloads/progress.json`);
  const raw = JSON.parse(readFileSync(progressPath, 'utf8')) as ProgressFile;
  const uploaded = Object.values(raw.uploaded ?? {});

  const lessons = uploaded
    .map((item) => {
      const title = item.title?.trim() ?? '';
      const videoId = item.video_id?.trim() ?? '';
      const parsed = parseLessonTitle(title);
      if (!parsed || !videoId) return null;
      return { title, videoId, ...parsed };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((a, b) => a.tepkich - b.tepkich || a.sabak - b.sabak);

  if (lessons.length !== EXPECTED_COUNT) {
    console.error(
      `Акыйда сабактары толук эмес: ${lessons.length}/${EXPECTED_COUNT}. YouTube жүктөө бүткөндөн кийин кайра иштетиңиз.`,
    );
    process.exit(1);
  }

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) {
    console.error('Акыйда курсу (slug: aqida) табылган жок');
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.lesson.deleteMany({ where: { courseId: course.id } });

    await tx.lesson.createMany({
      data: lessons.map((lesson, index) => ({
        courseId: course.id,
        title: lesson.title,
        description: `Акыйда ${lesson.tepkich}-тепкич, ${lesson.sabak}-сабак`,
        youtubeUrl: `https://youtu.be/${lesson.videoId}`,
        youtubeVideoId: lesson.videoId,
        lessonOrder: index + 1,
        isPublished: true,
      })),
    });
  });

  console.log(`✓ Акыйда курсуна ${lessons.length} сабак кошулду (unlisted шилтемелер).`);
  lessons.forEach((lesson, index) => {
    console.log(`  ${index + 1}. ${lesson.title} → https://youtu.be/${lesson.videoId}`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
