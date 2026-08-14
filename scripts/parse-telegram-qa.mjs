#!/usr/bin/env node
/**
 * Telegram «Суроо-жооп» каналын текст файлынан JSONга айландырат.
 *
 * Колдонуу:
 *   1. Telegram каналдан бардык билдирүүлөрдү .txt файлга көчүрүңүз
 *   2. node scripts/parse-telegram-qa.mjs suroo-joop.txt
 *   3. Чыkan telegram-questions.json файлын client/src/data/ ичинде бириктирүү
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Файл көрсөтүңүз: node scripts/parse-telegram-qa.mjs suroo-joop.txt');
  process.exit(1);
}

const text = readFileSync(resolve(inputPath), 'utf8');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function parseDate(text) {
  const match = text.match(/\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return '2024-01-01';
  const [, a, b, yearRaw] = match;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  // Telegram: күн/ай/жыл (5/3/24 = 5-март-2024)
  return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}

const blocks = text.split(/(?=\[\d{1,2}\/\d{1,2}\/\d{2,4})/);
const results = [];
const seenIds = new Set();

for (const block of blocks) {
  const questionMatch = block.match(/❓\s*СУРОО[^:]*:\s*([\s\S]*?)(?=✅|$)/i);
  const answerMatch = block.match(/✅\s*ЖООП:\s*([\s\S]*?)(?=#|\[|$)/i);
  if (!questionMatch || !answerMatch) continue;

  const question = questionMatch[1].replace(/\s+/g, ' ').trim();
  const answer = answerMatch[1].replace(/\s+/g, ' ').trim();
  if (!question || !answer) continue;

  const tags = [...block.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1].toLowerCase());
  const publishedAt = parseDate(block);
  const number = results.length + 1;

  let id = slugify(question);
  if (!id) id = `question-${results.length + 1}`;
  let uniqueId = id;
  let n = 2;
  while (seenIds.has(uniqueId)) {
    uniqueId = `${id}-${n++}`;
  }
  seenIds.add(uniqueId);

  results.push({
    id: uniqueId,
    number,
    question,
    answer,
    tags: [...new Set(tags)],
    publishedAt,
    views: 0,
  });
}

const outPath = resolve(process.cwd(), 'telegram-questions-parsed.json');
writeFileSync(outPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

console.log(`✓ ${results.length} суроо-жооп табылды`);
console.log(`✓ Файл: ${outPath}`);
console.log('');
console.log('Кийинки кадам — базага импорт:');
console.log('  npm run db:seed:qa -- telegram-questions-parsed.json');
