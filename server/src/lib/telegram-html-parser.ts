export type ParsedTelegramQa = {
  number: number;
  question: string;
  answer: string;
  tags: string[];
  publishedAt: string;
  telegramViews?: number;
};

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

function htmlFragmentToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a[^>]*onclick="return ShowHashtag\(&quot;([^&]+)&quot;\)"[^>]*>#?[^<]*<\/a>/gi, '#$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' '),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseTelegramDate(title: string | undefined, fallback: string) {
  if (!title) return fallback;
  const match = title.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return fallback;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractTags(html: string) {
  const tags = new Set<string>();
  for (const match of html.matchAll(/ShowHashtag\(&quot;([^&]+)&quot;\)/g)) {
    tags.add(match[1].toLowerCase());
  }
  for (const match of html.matchAll(/#([\p{L}\p{N}_-]+)/gu)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

function cleanQuestion(text: string) {
  return text
    .replace(/^❓\s*/u, '')
    .replace(/^СУРОО\s*№?\s*\d+\s*:?\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAnswer(text: string) {
  return text
    .replace(/^✅\s*/u, '')
    .replace(/^ЖООП\s*:?\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseTelegramHtmlExport(html: string): ParsedTelegramQa[] {
  const results: ParsedTelegramQa[] = [];
  const messageChunks = html.split(/(?=<div class="message default)/g);

  for (const chunk of messageChunks) {
    if (!chunk.includes('❓') || !/ЖООП/i.test(chunk)) continue;

    const textMatch = chunk.match(/<div class="text">\s*([\s\S]*?)<\/div>/i);
    if (!textMatch) continue;

    const textHtml = textMatch[1];
    const plain = htmlFragmentToText(textHtml);
    if (!plain.includes('❓') || !/ЖООП/i.test(plain)) continue;

    const numberMatch = plain.match(/СУРОО\s*№\s*(\d+)/iu);
    const number = numberMatch ? Number(numberMatch[1]) : results.length + 1;

    const parts = plain.split(/✅\s*ЖООП\s*:?\s*/iu);
    if (parts.length < 2) continue;

    const questionPart = parts[0];
    let answerPart = parts.slice(1).join('✅ ЖООП: ');

    answerPart = answerPart.split(/\n\s*#\S+/)[0] ?? answerPart;
    answerPart = answerPart.replace(/\n\s*Телеграм каналыбыз:[\s\S]*$/iu, '').trim();
    answerPart = answerPart.replace(/\n\s*Инстаграм баракчабыз:[\s\S]*$/iu, '').trim();

    const question = cleanQuestion(questionPart);
    const answer = cleanAnswer(answerPart);

    if (question.length < 3 || answer.length < 1) continue;

    const dateTitle = chunk.match(/title="(\d{2}\.\d{2}\.\d{4}[^"]*)"/)?.[1];
    const publishedAt = parseTelegramDate(dateTitle, '2024-03-05');

    results.push({
      number,
      question,
      answer,
      tags: extractTags(textHtml),
      publishedAt,
    });
  }

  const byNumber = new Map<number, ParsedTelegramQa>();
  for (const item of results) {
    if (!byNumber.has(item.number)) {
      byNumber.set(item.number, item);
    }
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}
