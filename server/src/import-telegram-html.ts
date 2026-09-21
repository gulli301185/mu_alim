import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { connectScriptDb } from './database/data-source';
import { parseTelegramHtmlExport } from './lib/telegram-html-parser.js';
import { importQaArticles } from './lib/qa-import-service.js';

let ds: DataSource;

async function main() {
  ds = await connectScriptDb();
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

  const result = await importQaArticles(ds, items, { replaceAll });

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
    await ds?.destroy();
  });
