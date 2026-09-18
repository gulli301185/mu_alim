import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();
const uploads = resolve(dirname(fileURLToPath(import.meta.url)), '../uploads/reviews');

async function main() {
  const course = await prisma.course.findUnique({ where: { slug: 'family' } });
  if (!course) throw new Error('Үй-бүлө курсу (family) табылган жок');

  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('Админ колдонуучу табылган жок');

  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const videoUrl = `/uploads/reviews/family-otz${n}.mp4`;
    const videoFile = resolve(uploads, `family-otz${n}.mp4`);
    if (!existsSync(videoFile)) {
      throw new Error(`Видео табылган жок: ${videoFile}`);
    }

    const existing = await prisma.review.findFirst({ where: { videoUrl } });
    if (existing) {
      console.log(`otz${n} already exists: ${existing.id}`);
      continue;
    }

    const review = await prisma.review.create({
      data: {
        userId: admin.id,
        courseId: course.id,
        rating: 5,
        comment: null,
        videoUrl,
        displayName: null,
        isAdminPosted: true,
        status: 'approved',
      },
    });
    console.log(`Created otz${n}: ${review.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
