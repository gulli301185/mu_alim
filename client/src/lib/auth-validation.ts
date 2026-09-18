import { z } from 'zod';
import { normalizeKgPhone } from './phone';

const nameRegex = /^[\p{L}\s'-]+$/u;

export const passwordSchema = z
  .string()
  .min(8, 'Сыр сөз кеминде 8 символдон турушу керек')
  .max(128, 'Сыр сөз өтө узун')
  .regex(/[a-zA-Zа-яА-ЯёЁөӨүҮңҢ]/, 'Сыр сөздө жок дегенде бир тамга болушу керек')
  .regex(/[0-9]/, 'Сыр сөздө жок дегенде бир сан болушу керек');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Электрондук почтаны толтуруңуз')
  .max(255, 'Электрондук почта өтө узун')
  .toLowerCase()
  .email('Электрондук почта туура эмес. Мисалы: aty@gmail.com')
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), 'Электрондук почта туура эмес');

export const requiredPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Телефон номерин толтуруңуз')
  .transform((value, ctx) => {
    const phone = normalizeKgPhone(value);
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Телефон туура эмес. Мисалы: +996 700 123 456',
      });
      return z.NEVER;
    }
    return phone;
  });

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
    phone: requiredPhoneSchema,
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

export const confirmCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Код 6 сандан турушу керек'),
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Код 6 сандан турушу керек'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Сыр сөздү кайталаңыз'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Сыр сөздөр дал келген жок',
    path: ['confirmPassword'],
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
