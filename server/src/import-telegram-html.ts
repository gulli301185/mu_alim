import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { parseTelegramHtmlExport } from './lib/telegram-html-parser.js';
import { importQaArticles } from './lib/qa-import-service.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const replaceAll = args.includes('--replace');
  const htmlPath = args.find((arg) => !arg.startsWith('--'));

  if (!htmlPath) {
    console.error('Колдонуу: npm run db:import:telegram-html -- [--replace] "/path/to/messages.html"');
    process.exit(1);
  }

  const absolutePath = resolve(htmlPath);
  console.log(`📄 Окуу: ${absolutePath}`);

  const html = readFileSync(absolutePath, 'utf8');
  const items = parseTelegramHtmlExport(html);

  console.log(`✓ Parser: ${items.length} суроо-жооп табылды`);

  const result = await importQaArticles(prisma, items, { replaceAll });

  console.log(`✓ Импорт аяктады:`);
  console.log(`  - Жаңы: ${result.created}`);
  console.log(`  - Жаңыртылган: ${result.updated}`);
  console.log(`  - Өзгөрбөгөн: ${result.skipped}`);
  console.log(`  - Бардыгы: ${result.total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
