import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';

/**
 * Entities mirror the existing PostgreSQL tables (see `server/db/schema.sql`).
 * The schema is never synchronised from here.
 *
 * The tables have no DEFAULT for `id` / `updated_at`, so the base classes fill them in when an
 * entity instance is saved. Bulk `update()` / query-builder writes must set `updatedAt` themselves.
 */

/** numeric → number (pg returns numeric as string). */
const numeric = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : Number(value)),
};

const timestamptz = { type: 'timestamptz' } as const;

abstract class Timestamps {
  @Column({ name: 'created_at', ...timestamptz })
  createdAt!: Date;

  @Column({ name: 'updated_at', ...timestamptz })
  updatedAt!: Date;

  @BeforeInsert()
  stampInsert() {
    const now = new Date();
    this.createdAt ??= now;
    this.updatedAt ??= now;
  }

  @BeforeUpdate()
  stampUpdate() {
    this.updatedAt = new Date();
  }
}

abstract class UuidTimestamps extends Timestamps {
  @PrimaryColumn('uuid')
  id!: string;

  @BeforeInsert()
  assignId() {
    this.id ??= randomUUID();
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

@Entity('users')
export class User extends UuidTimestamps {
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  phone!: string | null;

  @Column({ type: 'enum', enum: ['user', 'admin'], enumName: 'user_role', default: 'user' })
  role!: 'user' | 'admin';

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ name: 'last_login_at', ...timestamptz, nullable: true })
  lastLoginAt!: Date | null;

  @OneToMany(() => Enrollment, (e) => e.user)
  enrollments!: Relation<Enrollment[]>;

  @OneToMany(() => Certificate, (c) => c.user)
  certificates!: Relation<Certificate[]>;

  @OneToMany(() => CourseProgress, (p) => p.user)
  courseProgress!: Relation<CourseProgress[]>;
}

@Entity('user_profiles')
export class UserProfile extends UuidTimestamps {
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;
}

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ name: 'expires_at', ...timestamptz })
  expiresAt!: Date;

  @Column({ name: 'used_at', ...timestamptz, nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'created_at', ...timestamptz })
  createdAt!: Date;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
    this.createdAt ??= new Date();
  }
}

// ─── Courses ─────────────────────────────────────────────────────────────────

@Entity('categories')
export class Category extends UuidTimestamps {
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}

@Entity('courses')
export class Course extends UuidTimestamps {
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 280, unique: true })
  slug!: string;

  @Column({ name: 'short_description', type: 'varchar', length: 500, nullable: true })
  shortDescription!: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'cover_image', type: 'varchar', length: 500, nullable: true })
  coverImage!: string | null;

  @Column({ name: 'course_type', type: 'enum', enum: ['free', 'paid'], enumName: 'course_type' })
  courseType!: 'free' | 'paid';

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numeric })
  price!: number;

  @Column({ type: 'varchar', length: 10, default: 'KGS' })
  currency!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  level!: string | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null;

  @Column({ name: 'passing_score', type: 'numeric', precision: 5, scale: 2, default: 80, transformer: numeric })
  passingScore!: number;

  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular!: boolean;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ name: 'published_at', ...timestamptz, nullable: true })
  publishedAt!: Date | null;

  @OneToMany(() => Lesson, (l) => l.course)
  lessons!: Relation<Lesson[]>;
}

@Entity('lessons')
@Index(['courseId', 'lessonOrder'], { unique: true })
export class Lesson extends UuidTimestamps {
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'youtube_url', type: 'varchar', length: 500 })
  youtubeUrl!: string;

  @Column({ name: 'youtube_video_id', type: 'varchar', length: 50 })
  youtubeVideoId!: string;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'lesson_order', type: 'int' })
  lessonOrder!: number;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean;

  @ManyToOne(() => Course, (c) => c.lessons)
  @JoinColumn({ name: 'course_id' })
  course!: Relation<Course>;
}

// ─── Access & payments ───────────────────────────────────────────────────────

@Entity('enrollments')
@Index(['userId', 'courseId'], { unique: true })
export class Enrollment {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({
    type: 'enum',
    enum: ['active', 'completed', 'cancelled', 'expired'],
    enumName: 'enrollment_status',
  })
  status!: 'active' | 'completed' | 'cancelled' | 'expired';

  @Column({ name: 'enrolled_at', ...timestamptz })
  enrolledAt!: Date;

  @Column({ name: 'completed_at', ...timestamptz, nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => User, (u) => u.enrollments)
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course!: Relation<Course>;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
  }
}

@Entity('payments')
export class Payment extends UuidTimestamps {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numeric })
  amount!: number;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 50 })
  paymentMethod!: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 255, unique: true })
  transactionId!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed', 'refunded'],
    enumName: 'payment_status',
  })
  status!: 'pending' | 'success' | 'failed' | 'refunded';

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse!: unknown;

  @Column({ name: 'paid_at', ...timestamptz, nullable: true })
  paidAt!: Date | null;
}

// ─── Learning progress ───────────────────────────────────────────────────────

@Entity('lesson_progress')
@Index(['userId', 'lessonId'], { unique: true })
export class LessonProgress {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId!: string;

  @Column({ name: 'video_progress_seconds', type: 'int', default: 0 })
  videoProgressSeconds!: number;

  @Column({ name: 'is_video_completed', type: 'boolean', default: false })
  isVideoCompleted!: boolean;

  @Column({ name: 'is_lesson_completed', type: 'boolean', default: false })
  isLessonCompleted!: boolean;

  @Column({ name: 'completed_at', ...timestamptz, nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'updated_at', ...timestamptz })
  updatedAt!: Date;

  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lesson_id' })
  lesson!: Relation<Lesson>;
}

@Entity('course_progress')
@Index(['userId', 'courseId'], { unique: true })
export class CourseProgress {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'progress_percent', type: 'numeric', precision: 5, scale: 2, default: 0, transformer: numeric })
  progressPercent!: number;

  @Column({ name: 'last_lesson_id', type: 'uuid', nullable: true })
  lastLessonId!: string | null;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted!: boolean;

  @Column({ name: 'completed_at', ...timestamptz, nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'updated_at', ...timestamptz })
  updatedAt!: Date;

  @ManyToOne(() => User, (u) => u.courseProgress)
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course!: Relation<Course>;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: 'last_lesson_id' })
  lastLesson!: Relation<Lesson> | null;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
    this.updatedAt ??= new Date();
  }
}

@Entity('certificates')
@Index(['userId', 'courseId'], { unique: true })
export class Certificate {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'certificate_number', type: 'varchar', length: 100, unique: true })
  certificateNumber!: string;

  @Column({ name: 'verification_code', type: 'uuid', unique: true })
  verificationCode!: string;

  @Column({ name: 'pdf_file', type: 'varchar', length: 500 })
  pdfFile!: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 200, nullable: true })
  recipientName!: string | null;

  @Column({ name: 'issued_at', ...timestamptz })
  issuedAt!: Date;

  @Column({ name: 'created_at', ...timestamptz })
  createdAt!: Date;

  @ManyToOne(() => User, (u) => u.certificates)
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course!: Relation<Course>;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
    this.verificationCode ??= randomUUID();
    this.createdAt ??= new Date();
  }
}

// ─── Testing ─────────────────────────────────────────────────────────────────

@Entity('tests')
export class Test extends UuidTimestamps {
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'test_type', type: 'enum', enum: ['lesson', 'final'], enumName: 'test_type' })
  testType!: 'lesson' | 'final';

  @Column({ name: 'questions_count', type: 'int' })
  questionsCount!: number;

  @Column({ name: 'passing_score', type: 'numeric', precision: 5, scale: 2, default: 80, transformer: numeric })
  passingScore!: number;

  @Column({ name: 'max_attempts', type: 'int', nullable: true })
  maxAttempts!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course!: Relation<Course>;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: 'lesson_id' })
  lesson!: Relation<Lesson> | null;

  @OneToMany(() => TestQuestion, (tq) => tq.test)
  testQuestions!: Relation<TestQuestion[]>;
}

@Entity('questions')
export class Question extends UuidTimestamps {
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'question_text', type: 'text' })
  questionText!: string;

  @Column({
    name: 'question_type',
    type: 'enum',
    enum: ['choice', 'text'],
    enumName: 'question_type',
    default: 'choice',
  })
  questionType!: 'choice' | 'text';

  @Column({ name: 'correct_text_answer', type: 'text', nullable: true })
  correctTextAnswer!: string | null;

  @Column({ type: 'text', nullable: true })
  explanation!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => QuestionOption, (o) => o.question)
  options!: Relation<QuestionOption[]>;
}

@Entity('question_options')
export class QuestionOption {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ name: 'option_text', type: 'text' })
  optionText!: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect!: boolean;

  @Column({ name: 'option_order', type: 'int' })
  optionOrder!: number;

  @ManyToOne(() => Question, (q) => q.options)
  @JoinColumn({ name: 'question_id' })
  question!: Relation<Question>;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
  }
}

@Entity('test_questions')
export class TestQuestion {
  @PrimaryColumn({ name: 'test_id', type: 'uuid' })
  testId!: string;

  @PrimaryColumn({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ name: 'question_order', type: 'int', nullable: true })
  questionOrder!: number | null;

  @ManyToOne(() => Test, (t) => t.testQuestions)
  @JoinColumn({ name: 'test_id' })
  test!: Relation<Test>;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'question_id' })
  question!: Relation<Question>;
}

@Entity('test_attempts')
export class TestAttempt {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'test_id', type: 'uuid' })
  testId!: string;

  @Column({ name: 'attempt_number', type: 'int' })
  attemptNumber!: number;

  @Column({ name: 'total_questions', type: 'int' })
  totalQuestions!: number;

  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correctAnswers!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numeric })
  score!: number;

  @Column({ type: 'boolean', default: false })
  passed!: boolean;

  @Column({ name: 'started_at', ...timestamptz })
  startedAt!: Date;

  @Column({ name: 'completed_at', ...timestamptz, nullable: true })
  completedAt!: Date | null;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
  }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

@Entity('reviews')
export class Review extends UuidTimestamps {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'video_url', type: 'varchar', length: 500, nullable: true })
  videoUrl!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 150, nullable: true })
  displayName!: string | null;

  @Column({ name: 'is_admin_posted', type: 'boolean', default: false })
  isAdminPosted!: boolean;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    enumName: 'review_status',
  })
  status!: 'pending' | 'approved' | 'rejected';

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course!: Relation<Course>;
}

// ─── Content ─────────────────────────────────────────────────────────────────

@Entity('qa_articles')
export class QaArticle extends UuidTimestamps {
  @Column({ type: 'varchar', length: 280, unique: true })
  slug!: string;

  @Column({ name: 'question_number', type: 'int', nullable: true })
  questionNumber!: number | null;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  excerpt!: string | null;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  tags!: string[];

  @Column({ type: 'enum', enum: ['text', 'video'], enumName: 'qa_article_type', default: 'text' })
  type!: 'text' | 'video';

  @Column({ name: 'telegram_views', type: 'int', default: 0 })
  telegramViews!: number;

  @Column({ name: 'site_views', type: 'int', default: 0 })
  siteViews!: number;

  @Column({ type: 'int', default: 0 })
  views!: number;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished!: boolean;

  @Column({ name: 'published_at', ...timestamptz })
  publishedAt!: Date;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById!: string | null;

  @OneToOne(() => TeacherQuestionSubmission, (s) => s.qaArticle)
  teacherSubmission!: Relation<TeacherQuestionSubmission> | null;
}

@Entity('teacher_question_submissions')
export class TeacherQuestionSubmission {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'question_number', type: 'int', nullable: true })
  questionNumber!: number | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text', nullable: true })
  answer!: string | null;

  @Column({ name: 'qa_article_id', type: 'uuid', nullable: true, unique: true })
  qaArticleId!: string | null;

  @Column({ name: 'answered_at', ...timestamptz, nullable: true })
  answeredAt!: Date | null;

  @Column({ name: 'created_at', ...timestamptz })
  createdAt!: Date;

  @OneToOne(() => QaArticle, (a) => a.teacherSubmission, { nullable: true })
  @JoinColumn({ name: 'qa_article_id' })
  qaArticle!: Relation<QaArticle> | null;

  @BeforeInsert()
  init() {
    this.id ??= randomUUID();
    this.createdAt ??= new Date();
  }
}

@Entity('hero_banners')
export class HeroBanner extends Timestamps {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  subtitle!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'sky_image_url', type: 'varchar', length: 500 })
  skyImageUrl!: string;

  @Column({ name: 'banner_image_url', type: 'varchar', length: 500 })
  bannerImageUrl!: string;
}

@Entity('site_images')
export class SiteImage extends Timestamps {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;
}

export const ENTITIES = [
  User,
  UserProfile,
  PasswordResetToken,
  Category,
  Course,
  Lesson,
  Enrollment,
  Payment,
  LessonProgress,
  CourseProgress,
  Certificate,
  Test,
  Question,
  QuestionOption,
  TestQuestion,
  TestAttempt,
  Review,
  QaArticle,
  TeacherQuestionSubmission,
  HeroBanner,
  SiteImage,
];
