import { prisma } from './prisma.js';

export async function userCanWatchPaidCourse(
  user: { id: string; role: 'user' | 'admin' } | undefined,
  courseId: string,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { status: true },
  });

  return enrollment?.status === 'active';
}
