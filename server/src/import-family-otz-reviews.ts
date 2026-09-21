import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { connectScriptDb } from './database/data-source';
import { Course, Review, User } from './database/entities';

let ds: DataSource;
const uploads = resolve(__dirname, '../uploads/reviews');

async function main() {
  ds = await connectScriptDb();
  const course = await ds.getRepository(Course).findOneBy({ slug: 'family' });
  if (!course) throw new Error('Үй-бүлө курсу (family) табылган жок');

  const admin = await ds.getRepository(User).findOneBy({ role: 'admin' });
  if (!admin) throw new Error('Админ колдонуучу табылган жок');

  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const videoUrl = `/uploads/reviews/family-otz${n}.mp4`;
    const videoFile = resolve(uploads, `family-otz${n}.mp4`);
    if (!existsSync(videoFile)) {
      throw new Error(`Видео табылган жок: ${videoFile}`);
    }

    const existing = await ds.getRepository(Review).findOneBy({ videoUrl });
    if (existing) {
      console.log(`otz${n} already exists: ${existing.id}`);
      continue;
    }

    const review = await ds.getRepository(Review).save(
      ds.getRepository(Review).create({
        userId: admin.id,
        courseId: course.id,
        rating: 5,
        comment: null,
        videoUrl,
        displayName: null,
        isAdminPosted: true,
        status: 'approved',
      }),
    );
    console.log(`Created otz${n}: ${review.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await ds?.destroy();
  });
