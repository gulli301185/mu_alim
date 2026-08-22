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

export const registerSchema = z.object({
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
  });

export const updateProfileSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'Аты кеминде 2 тамгадан турушу керек')
      .max(100)
      .regex(nameRegex, 'Атта тек тамгалар болушу керек')
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(2, 'Фамилия кеминде 2 тамгадан турушу керек')
      .max(100)
      .regex(nameRegex, 'Фамилияда тек тамгалар болушу керек')
      .optional(),
    email: emailSchema.optional(),
    phone: z.string().trim().nullable().optional(),
    currentPassword: z.string().min(6).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (data) => {
      const hasCurrent = Boolean(data.currentPassword);
      const hasNew = Boolean(data.newPassword);
      return hasCurrent === hasNew;
    },
    { message: 'Жаңы сыр сөз үчүн учурдагы сыр сөз керек', path: ['currentPassword'] },
  );

export function formatZodError(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  const first = error.issues[0]?.message ?? 'Маалымат туура эмес';
  return { error: first, fields };
}
