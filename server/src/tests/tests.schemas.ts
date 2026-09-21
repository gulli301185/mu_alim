import { z } from 'zod';

const choiceOptionSchema = z.object({
  optionText: z.string().trim().min(1),
  isCorrect: z.boolean(),
  optionOrder: z.number().int().min(1).max(4),
});

export const questionInputSchema = z.discriminatedUnion('questionType', [
  z.object({
    questionType: z.literal('choice'),
    questionText: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
    options: z.array(choiceOptionSchema).length(4),
  }),
  z.object({
    questionType: z.literal('text'),
    questionText: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
    correctTextAnswer: z.string().trim().min(1),
  }),
]);

export const createTestSchema = z.object({
  courseRef: z.string().trim().min(1),
  title: z.string().trim().min(1).max(255).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  questions: z.array(questionInputSchema).min(1),
});

export const updateTestSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  questions: z.array(questionInputSchema).min(1).optional(),
});

export const gradeSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedOptionId: z.string().uuid().optional(),
      textAnswer: z.string().optional(),
    }),
  ),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type GradeAnswers = z.infer<typeof gradeSchema>['answers'];
