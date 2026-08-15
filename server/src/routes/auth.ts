import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  password: z.string().min(6),
});

const updateProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).nullable().optional(),
    currentPassword: z.string().min(6).optional(),
    newPassword: z.string().min(6).optional(),
  })
  .refine(
    (data) => {
      const hasCurrent = Boolean(data.currentPassword);
      const hasNew = Boolean(data.newPassword);
      return hasCurrent === hasNew;
    },
    { message: 'Жаңы сыр сөз үчүн учурдагы сыр сөз керек' },
  );

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

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Email же сыр сөз туура эмес' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Кирүү ийгиликсиз' });
      return;
    }

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Кирүү ийгиликсиз' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ error: 'Бул email менен аккаунт бар' });
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
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Маалымат туура эмес' });
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
        res.status(409).json({ error: 'Бул email ээсе болгон' });
        return;
      }
    }

    let passwordHash = user.passwordHash;
    if (parsed.data.currentPassword && parsed.data.newPassword) {
      const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
      if (!ok) {
        res.status(400).json({ error: 'Учурдагы сыр сөз туура эмес' });
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
