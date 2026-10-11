import { z } from 'zod';
import { normalizeKgPhone } from './phone';
import i18n from '../i18n';

// Schema messages are translation keys under "validation" in the locale
// files; they're resolved at display time so a language switch applies
// without rebuilding the (module-level) schemas.
function translateIssue(message: string) {
  return i18n.t(`validation.${message}`, { defaultValue: message });
}

const nameRegex = /^[\p{L}\s'-]+$/u;

export const passwordSchema = z
  .string()
  .min(8, 'passwordMin')
  .max(128, 'passwordMax')
  .regex(/[a-zA-Zа-яА-ЯёЁөӨүҮңҢ]/, 'passwordLetter')
  .regex(/[0-9]/, 'passwordDigit');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'emailRequired')
  .max(255, 'emailMax')
  .toLowerCase()
  .email('emailInvalidExample')
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), 'emailInvalid');

export const requiredPhoneSchema = z
  .string()
  .trim()
  .min(1, 'phoneRequired')
  .transform((value, ctx) => {
    const phone = normalizeKgPhone(value);
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'phoneInvalid',
      });
      return z.NEVER;
    }
    return phone;
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'passwordRequired'),
});

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'firstNameMin')
      .max(100, 'firstNameMax')
      .regex(nameRegex, 'firstNameLetters'),
    lastName: z
      .string()
      .trim()
      .min(2, 'lastNameMin')
      .max(100, 'lastNameMax')
      .regex(nameRegex, 'lastNameLetters'),
    email: emailSchema,
    phone: requiredPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'confirmRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsMismatch',
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
    .regex(/^\d{6}$/, 'code6'),
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'code6'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'confirmRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
  });

export type FieldErrors = Record<string, string>;

export function formatZodErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fields[key]) {
      fields[key] = translateIssue(issue.message);
    }
  }
  return fields;
}

export function firstZodError(error: z.ZodError) {
  return translateIssue(error.issues[0]?.message ?? 'invalidData');
}
