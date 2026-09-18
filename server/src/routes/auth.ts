import { randomInt } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import {
  confirmCodeSchema,
  forgotPasswordSchema,
  formatZodError,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../lib/auth-validation.js';
import { isMailConfigured, sendAuthCode } from '../lib/mail.js';
import { isSmsConfigured, sendPasswordResetSms } from '../lib/sms.js';
import { findUserByKgPhone } from '../lib/user-phone.js';

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

async function issueAuthCode(userId: string) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  let code = String(randomInt(100000, 1000000));
  let tokenId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.passwordResetToken.create({
        data: {
          userId,
          token: code,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      tokenId = created.id;
      break;
    } catch {
      code = String(randomInt(100000, 1000000));
      if (attempt === 4) throw new Error('Код түзүлгөн жок');
    }
  }
  return { code, tokenId };
}

async function deliverAuthCode(
  email: string,
  phone: string | null,
  code: string,
  kind: 'reset' | 'register',
) {
  if (isMailConfigured()) {
    try {
      await sendAuthCode(email, code, kind);
      return 'email' as const;
    }     catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[auth-code] mail failed', message);
    }
  }

  if (isSmsConfigured() && phone) {
    try {
      await sendPasswordResetSms(phone, code);
      return 'sms' as const;
    } catch (err) {
      console.error('[auth-code] sms failed', err);
    }
  }

  return null;
}

function deliveryMessage(delivered: 'email' | 'sms') {
  return delivered === 'sms'
    ? 'Код телефонуңузга SMS менен жөнөтүлдү.'
    : 'Код почтаңызга жөнөтүлдү. Почтаңызды текшериңиз.';
}

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'user' | 'admin';
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
  };
}

async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!user || !user.isActive) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

function validationResponse(res: import('express').Response, parsed: { success: false; error: import('zod').ZodError }) {
  const { error, fields } = formatZodError(parsed.error);
  res.status(400).json({ error, fields });
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await authenticateUser(email, parsed.data.password);
    if (!user) {
      res.status(401).json({ error: 'Электрондук почта же сыр сөз туура эмес' });
      return;
    }

    if (user.role === 'admin') {
      res.status(403).json({ error: 'Админ үчүн /admin/login баракчасын колдонуңуз' });
      return;
    }

    res.json({
      token: signToken({ id: user.id, role: user.role }),
      user: toPublicUser(user),
    });
  }),
);

authRouter.post(
  '/admin/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await authenticateUser(email, parsed.data.password);
    if (!user) {
      res.status(401).json({ error: 'Электрондук почта же сыр сөз туура эмес' });
      return;
    }

    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Админ укугу жок' });
      return;
    }

    res.json({
      token: signToken({ id: user.id, role: user.role }),
      user: toPublicUser(user),
    });
  }),
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const phone = parsed.data.phone;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      if (exists.role === 'admin' || !exists.isActive) {
        res.status(409).json({
          error: 'Бул электрондук почта менен аккаунт бар',
          fields: { email: 'Бул электрондук почта менен аккаунт бар' },
        });
        return;
      }
      if (!exists.isVerified) {
        const { code, tokenId } = await issueAuthCode(exists.id);
        const delivered = await deliverAuthCode(email, exists.phone, code, 'register');
        if (!delivered) {
          if (tokenId) {
            await prisma.passwordResetToken.update({
              where: { id: tokenId },
              data: { usedAt: new Date() },
            });
          }
          res.status(503).json({
            error: 'Код почтага жөнөтүлгөн жок. Кийинчерээк кайра кайталап көрүңүз.',
          });
          return;
        }
        res.status(200).json({
          needsConfirmation: true,
          email,
          message: deliveryMessage(delivered),
        });
        return;
      }
      res.status(409).json({
        error: 'Бул электрондук почта менен аккаунт бар',
        fields: { email: 'Бул электрондук почта менен аккаунт бар' },
      });
      return;
    }

    const phoneTaken = await findUserByKgPhone(phone);
    if (phoneTaken) {
      res.status(409).json({
        error: 'Бул телефон менен аккаунт бар',
        fields: { phone: 'Бул телефон менен аккаунт бар' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        phone,
        role: 'user',
        isActive: true,
        isVerified: false,
        profile: { create: {} },
      },
    });

    const { code } = await issueAuthCode(user.id);
    const delivered = await deliverAuthCode(email, phone, code, 'register');
    if (!delivered) {
      await prisma.user.delete({ where: { id: user.id } });
      res.status(503).json({
        error: 'Код почтага жөнөтүлгөн жок. Кийинчерээк кайра кайталап көрүңүз.',
      });
      return;
    }

    res.status(201).json({
      needsConfirmation: true,
      email,
      message: deliveryMessage(delivered),
    });
  }),
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const email = parsed.data.email;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user || !user.isActive || user.role === 'admin') {
      res.status(400).json({
        error: 'Бул почта менен аккаунт жок',
        fields: { email: 'Бул почта менен аккаунт жок' },
      });
      return;
    }

    const { code, tokenId } = await issueAuthCode(user.id);
    const delivered = await deliverAuthCode(email, user.phone, code, 'reset');
    if (!delivered) {
      if (tokenId) {
        await prisma.passwordResetToken.update({
          where: { id: tokenId },
          data: { usedAt: new Date() },
        });
      }
      res.status(503).json({
        error: isMailConfigured()
          ? 'Код почтага жөнөтүлгөн жок. Кийинчерээк кайра кайталап көрүңүз.'
          : 'Код почтага жөнөтүлгөн жок. Почта сервиси туташа элек.',
      });
      return;
    }

    res.json({ message: deliveryMessage(delivered) });
  }),
);

authRouter.post(
  '/confirm-code',
  asyncHandler(async (req, res) => {
    const parsed = confirmCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const email = parsed.data.email;
    const code = parsed.data.code.trim();
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user || !user.isActive || user.role === 'admin') {
      res.status(400).json({
        error: 'Код жараксыз же мөөнөтү өткөн',
        fields: { code: 'Код жараксыз же мөөнөтү өткөн' },
      });
      return;
    }

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        token: code,
        usedAt: null,
        userId: user.id,
      },
    });

    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({
        error: 'Код жараксыз же мөөнөтү өткөн',
        fields: { code: 'Код жараксыз же мөөнөтү өткөн' },
      });
      return;
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, lastLoginAt: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      token: signToken({ id: updated.id, role: updated.role }),
      user: toPublicUser(updated),
    });
  }),
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const token = parsed.data.token.trim();
    const email = parsed.data.email;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user || !user.isActive || user.role === 'admin') {
      res.status(400).json({
        error: 'Код жараксыз же мөөнөтү өткөн',
        fields: { token: 'Код жараксыз же мөөнөтү өткөн' },
      });
      return;
    }

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        userId: user.id,
      },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
      res.status(400).json({
        error: 'Код жараксыз же мөөнөтү өткөн',
        fields: { token: 'Код жараксыз же мөөнөтү өткөн' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, isVerified: true },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Сыр сөз ийгиликтүү өзгөртүлдү' });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Колдонуучу табылган жок' });
      return;
    }

    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      validationResponse(res, parsed);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Колдонуучу табылган жок' });
      return;
    }

    if (parsed.data.email && parsed.data.email.trim().toLowerCase() !== user.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: parsed.data.email.trim().toLowerCase() },
      });
      if (emailTaken) {
        res.status(409).json({ error: 'Бул электрондук почта ээсе болгон', fields: { email: 'Бул электрондук почта ээсе болгон' } });
        return;
      }
    }

    if (parsed.data.phone && parsed.data.phone !== user.phone) {
      const phoneTaken = await findUserByKgPhone(parsed.data.phone, user.id);
      if (phoneTaken) {
        res.status(409).json({
          error: 'Бул телефон менен аккаунт бар',
          fields: { phone: 'Бул телефон менен аккаунт бар' },
        });
        return;
      }
    }

    let passwordHash = user.passwordHash;
    if (parsed.data.currentPassword && parsed.data.newPassword) {
      const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
      if (!ok) {
        res.status(400).json({
          error: 'Учурдагы сыр сөз туура эмес',
          fields: { currentPassword: 'Учурдагы сыр сөз туура эмес' },
        });
        return;
      }
      passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.firstName !== undefined ? { firstName: parsed.data.firstName.trim() } : {}),
        ...(parsed.data.lastName !== undefined ? { lastName: parsed.data.lastName.trim() } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email.trim().toLowerCase() } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.newPassword ? { passwordHash } : {}),
      },
    });

    res.json({ user: toPublicUser(updated) });
  }),
);
