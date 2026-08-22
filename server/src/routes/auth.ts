import { randomInt } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import {
  forgotPasswordSchema,
  formatZodError,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../lib/auth-validation.js';

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

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
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ error: 'Бул электрондук почта менен аккаунт бар', fields: { email: 'Бул электрондук почта менен аккаунт бар' } });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        phone: parsed.data.phone?.trim() || null,
        role: 'user',
        isActive: true,
        profile: { create: {} },
      },
    });

    res.status(201).json({
      token: signToken({ id: user.id, role: user.role }),
      user: toPublicUser(user),
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

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    const genericMessage =
      'Эгер бул электрондук почта менен аккаунт бар болсо, код түзүлдү';

    if (!user || !user.isActive || user.role === 'admin') {
      res.json({ message: genericMessage });
      return;
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    let code = String(randomInt(100000, 1000000));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token: code,
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        });
        break;
      } catch {
        code = String(randomInt(100000, 1000000));
        if (attempt === 4) throw new Error('Код түзүлгөн жок');
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[password-reset] ${email}: code ${code}`);
    }

    res.json({
      message: 'Код түзүлдү. Аны жазып, жаңы сыр сөздү коюңуз',
      code,
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
    const email = parsed.data.email?.trim().toLowerCase();

    const record = email
      ? await prisma.passwordResetToken.findFirst({
          where: {
            token,
            usedAt: null,
            user: { email, isActive: true },
          },
          include: { user: true },
        })
      : await prisma.passwordResetToken.findUnique({
          where: { token },
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
        data: { passwordHash },
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
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone?.trim() || null } : {}),
        ...(parsed.data.newPassword ? { passwordHash } : {}),
      },
    });

    res.json({ user: toPublicUser(updated) });
  }),
);
