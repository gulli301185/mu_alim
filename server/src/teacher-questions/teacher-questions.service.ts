import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { CacheService } from '../cache/cache.service';
import { QaArticle, TeacherQuestionSubmission } from '../database/entities';
import { escapeLike } from '../database/sql';
import { uniqueSlug } from '../lib/slug';

export const submitSchema = z.object({
  name: z.string().trim().min(2, 'Аты-жөнү керек').max(200),
  question: z.string().trim().min(10, 'Суроо кыска').max(4000),
});

export const adminListQuerySchema = z.object({
  status: z.enum(['pending', 'answered', 'all']).default('pending'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

export const publishSchema = z.object({
  answer: z.string().trim().min(1, 'Жооп керек').max(20000),
});

function toAdminItem(row: {
  id: string;
  questionNumber: number | null;
  name: string;
  question: string;
  answer: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  qaArticle: { slug: string } | null;
}) {
  return {
    id: row.id,
    questionNumber: row.questionNumber,
    name: row.name,
    question: row.question,
    answer: row.answer,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
    qaSlug: row.qaArticle?.slug ?? null,
    status: row.qaArticle ? ('answered' as const) : ('pending' as const),
  };
}

@Injectable()
export class TeacherQuestionsService {
  constructor(
    @InjectRepository(TeacherQuestionSubmission)
    private readonly submissions: Repository<TeacherQuestionSubmission>,
    private readonly ds: DataSource,
    private readonly cache: CacheService,
  ) {}

  async getNextQuestionNumber(em: EntityManager = this.ds.manager): Promise<number> {
    const max = async (target: typeof QaArticle | typeof TeacherQuestionSubmission) => {
      const row = await em
        .createQueryBuilder(target as never, 't')
        .select('MAX(t.questionNumber)', 'max')
        .getRawOne<{ max: number | null }>();
      return row?.max ?? 0;
    };

    // Sequential: inside a transaction both queries share a single connection.
    const qaMax = await max(QaArticle);
    const submissionMax = await max(TeacherQuestionSubmission);
    return Math.max(qaMax, submissionMax) + 1;
  }

  async nextNumber() {
    return { nextNumber: await this.getNextQuestionNumber() };
  }

  async submit(data: z.infer<typeof submitSchema>) {
    const row = await this.ds.transaction(async (em) => {
      const questionNumber = await this.getNextQuestionNumber(em);
      return em.save(
        em.create(TeacherQuestionSubmission, {
          ...data,
          questionNumber,
          answer: null,
          qaArticleId: null,
          answeredAt: null,
        }),
      );
    });

    return {
      id: row.id,
      questionNumber: row.questionNumber,
      message: `${row.questionNumber}-суроо жөнөтүлдү. Жакынкы арада жооп беребиз.`,
    };
  }

  async adminList({ status, page, limit, q }: z.infer<typeof adminListQuerySchema>) {
    const qb = this.submissions
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.qaArticle', 'a')
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status === 'pending') qb.andWhere('s.qaArticleId IS NULL');
    if (status === 'answered') qb.andWhere('s.qaArticleId IS NOT NULL');
    if (q) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('s.name ILIKE :like', { like: `%${escapeLike(q)}%` })
            .orWhere('s.question ILIKE :like');
          if (Number.isFinite(Number(q))) w.orWhere('s.questionNumber = :num', { num: Number(q) });
        }),
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map(toAdminItem),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async publishSubmission(
    em: EntityManager,
    submissionId: string,
    answer: string,
    createdById?: string,
  ) {
    const submission = await em.findOneBy(TeacherQuestionSubmission, { id: submissionId });
    if (!submission) throw new AppError(404, 'Суроо табылган жок');
    if (submission.qaArticleId) throw new AppError(409, 'Бул суроо мурунтан жарияланган');

    const slugBase =
      submission.questionNumber != null ? `${submission.questionNumber}-suroo` : submission.question;

    const slug = await uniqueSlug(slugBase, async (candidate) => {
      const found = await em.findOneBy(QaArticle, { slug: candidate });
      return Boolean(found);
    });

    const article = await em.save(
      em.create(QaArticle, {
        slug,
        questionNumber: submission.questionNumber,
        question: submission.question,
        answer,
        excerpt: null,
        tags: [],
        isPublished: true,
        publishedAt: new Date(),
        createdById: createdById ?? null,
      }),
    );

    await em.update(
      TeacherQuestionSubmission,
      { id: submission.id },
      { answer, qaArticleId: article.id, answeredAt: new Date() },
    );

    return article;
  }

  async publish(id: string, answer: string, adminId?: string) {
    const article = await this.ds.transaction((em) => this.publishSubmission(em, id, answer, adminId));
    await this.cache.invalidate('qa:');

    return {
      slug: article.slug,
      questionNumber: article.questionNumber,
      message:
        article.questionNumber != null
          ? `${article.questionNumber}-суроо жарияланды`
          : 'Суроо-жооп жарияланды',
    };
  }
}

