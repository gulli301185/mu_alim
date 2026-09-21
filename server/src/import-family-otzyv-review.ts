import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const VIDEO_URL = '/uploads/reviews/family-otzyv.mp4';
const VIDEO_FILE = resolve(__dirname, '../uploads/reviews/family-otzyv.mp4');

async function main() {
  if (!existsSync(VIDEO_FILE)) {
    throw new Error(`Видео табылган жок: ${VIDEO_FILE}`);
  }

  const course = await prisma.course.findUnique({ where: { slug: 'family' } });
  if (!course) throw new Error('Үй-бүлө курсу (family) табылган жок');

  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) throw new Error('Админ колдонуучу табылган жок');

  const existing = await prisma.review.findFirst({ where: { videoUrl: VIDEO_URL } });
  if (existing) {
    console.log(`Video review already exists: ${existing.id}`);
    return;
  }

  const review = await prisma.review.create({
    data: {
      userId: admin.id,
      courseId: course.id,
      rating: 5,
      comment: null,
      videoUrl: VIDEO_URL,
      displayName: 'Окуучу',
      isAdminPosted: true,
      status: 'approved',
    },
  });

  console.log(`Created family video review: ${review.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
