import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SITE_IMAGES,
  SITE_IMAGE_SEED_FILES,
  type SiteImageKey,
} from './data/site-images.js';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const root = resolve(__dirname, '../..');
const publicDir = resolve(root, 'client/public');
const uploadsDir = resolve(root, 'server/uploads');

async function main() {
  mkdirSync(uploadsDir, { recursive: true });

  for (const key of Object.keys(DEFAULT_SITE_IMAGES) as SiteImageKey[]) {
    const fileName = SITE_IMAGE_SEED_FILES[key];
    const source = resolve(publicDir, fileName);
    const target = resolve(uploadsDir, fileName);
    const url = DEFAULT_SITE_IMAGES[key];

    if (existsSync(source)) {
      copyFileSync(source, target);
      console.log(`Copied ${fileName}`);
    } else {
      console.warn(`Skip copy (missing): ${source}`);
    }

    await prisma.siteImage.upsert({
      where: { key },
      update: { url },
      create: { key, url },
    });
  }

  await prisma.heroBanner.upsert({
    where: { id: 'default' },
    update: {
      skyImageUrl: DEFAULT_SITE_IMAGES['hero.sky'],
      bannerImageUrl: DEFAULT_SITE_IMAGES['hero.banner'],
    },
    create: {
      id: 'default',
      title: 'Бийиктикке умтул!',
      subtitle: 'Билим эркиндикке жол ачат, амал ийгиликке жеткирет.',
      name: 'Мухаммадалим',
      skyImageUrl: DEFAULT_SITE_IMAGES['hero.sky'],
      bannerImageUrl: DEFAULT_SITE_IMAGES['hero.banner'],
    },
  });

  console.log('Site images seeded.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
