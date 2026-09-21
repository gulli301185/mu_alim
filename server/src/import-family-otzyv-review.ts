import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { connectScriptDb } from './database/data-source';
import { Course, Review, User } from './database/entities';

let ds: DataSource;
const VIDEO_URL = '/uploads/reviews/family-otzyv.mp4';
const VIDEO_FILE = resolve(__dirname, '../uploads/reviews/family-otzyv.mp4');

async function main() {
  ds = await connectScriptDb();
  if (!existsSync(VIDEO_FILE)) {
    throw new Error(`Видео табылган жок: ${VIDEO_FILE}`);
  }

  const course = await ds.getRepository(Course).findOneBy({ slug: 'family' });
  if (!course) throw new Error('Үй-бүлө курсу (family) табылган жок');

  const admin = await ds.getRepository(User).findOneBy({ role: 'admin' });
  if (!admin) throw new Error('Админ колдонуучу табылган жок');

  const existing = await ds.getRepository(Review).findOneBy({ videoUrl: VIDEO_URL });
  if (existing) {
    console.log(`Video review already exists: ${existing.id}`);
    return;
  }

  const review = await ds.getRepository(Review).save(
    ds.getRepository(Review).create({
      userId: admin.id,
      courseId: course.id,
      rating: 5,
      comment: null,
      videoUrl: VIDEO_URL,
      displayName: 'Окуучу',
      isAdminPosted: true,
      status: 'approved',
    }),
  );

  console.log(`Created family video review: ${review.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await ds?.destroy();
  });
