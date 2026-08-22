import { z } from 'zod';

const nameRegex = /^[\p{L}\s'-]+$/u;

export const passwordSchema = z
  .string()
  .min(8, 'Сыр сөз кеминде 8 символдон турушу керек')
  .max(128, 'Сыр сөз өтө узун')
  .regex(/[a-zA-Z]/, 'Сыр сөздө жок дегенде бир тамга болушу керек')
  .regex(/[0-9]/, 'Сыр сөздө жок дегенде бир сан болушу керек');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Электрондук почтаны толтуруңуз')
  .email('Электрондук почта туура эмес');

export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || /^\+?[0-9\s()-]{7,20}$/.test(value),
    'Телефон туура эмес',
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Сыр сөздү киргизиңиз'),
});

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'Аты кеминде 2 тамгадан турушу керек')
      .max(100, 'Аты өтө узун')
      .regex(nameRegex, 'Атта тек тамгалар болушу керек'),
    lastName: z
      .string()
      .trim()
      .min(2, 'Фамилия кеминде 2 тамгадан турушу керек')
      .max(100, 'Фамилия өтө узун')
      .regex(nameRegex, 'Фамилияда тек тамгалар болушу керек'),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Сыр сөздү кайталаңыз'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Сыр сөздөр дал келген жок',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Кодду киргизиңиз'),
    email: emailSchema.optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Сыр сөздү кайталаңыз'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Сыр сөздөр дал келген жок',
    path: ['confirmPassword'],
  })
  .superRefine((data, ctx) => {
    if (data.email && !/^\d{6}$/.test(data.token)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['token'],
        message: 'Код 6 сандан турушу керек',
      });
    }
  });

export type FieldErrors = Record<string, string>;

export function formatZodErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function firstZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Маалымат туура эмес';
}
