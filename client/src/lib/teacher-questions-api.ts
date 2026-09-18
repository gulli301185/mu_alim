import { API_BASE } from './asset-url';

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

export async function fetchNextTeacherQuestionNumber(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/teacher-questions/next-number`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Суроо номери алынган жок'));
  }
  const data = (await res.json()) as { nextNumber: number };
  return data.nextNumber;
}

export async function submitTeacherQuestion(input: {
  name: string;
  question: string;
}): Promise<{ message: string; questionNumber?: number }> {
  const res = await fetch(`${API_BASE}/api/teacher-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readError(res, 'Суроо жөнөтүлгөн жок'));
  }

  return res.json() as Promise<{ message: string; questionNumber?: number }>;
}
