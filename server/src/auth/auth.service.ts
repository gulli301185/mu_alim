import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../mail/sms.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { PasswordResetToken, User, UserProfile } from '../database/entities';
import { findUserByKgPhone } from '../lib/user-phone';
import type {
  confirmCodeSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../lib/auth-validation';
import type { z } from 'zod';

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

type PublicUserSource = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'user' | 'admin';
};

export function toPublicUser(user: PublicUserSource) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
  };
}

function deliveryMessage(delivered: 'email' | 'sms') {
  return delivered === 'sms'
    ? 'Код телефонуңузга SMS менен жөнөтүлдү.'
    : 'Код почтаңызга жөнөтүлдү. Почтаңызды текшериңиз.';
}

const CODE_INVALID = 'Код жараксыз же мөөнөтү өткөн';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    private readonly ds: DataSource,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
  ) {}

  signToken(user: AuthUser) {
    return this.jwt.sign({ id: user.id, role: user.role });
  }

  private async issueAuthCode(userId: string) {
    await this.tokens.update({ userId, usedAt: IsNull() }, { usedAt: new Date() });

    let code = String(randomInt(100000, 1000000));
    let tokenId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await this.tokens.save(
          this.tokens.create({
            userId,
            token: code,
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
            usedAt: null,
          }),
        );
        tokenId = created.id;
        break;
      } catch {
        code = String(randomInt(100000, 1000000));
        if (attempt === 4) throw new Error('Код түзүлгөн жок');
      }
    }
    return { code, tokenId };
  }

  private async deliverAuthCode(
    email: string,
    phone: string | null,
    code: string,
    kind: 'reset' | 'register',
  ) {
    if (this.mail.isConfigured()) {
      try {
        await this.mail.sendAuthCode(email, code, kind);
        return 'email' as const;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`[auth-code] mail failed ${message}`);
      }
    }

    if (this.sms.isConfigured() && phone) {
      try {
        await this.sms.sendPasswordResetSms(phone, code);
        return 'sms' as const;
      } catch (err) {
        this.logger.error(`[auth-code] sms failed ${err instanceof Error ? err.message : err}`);
      }
    }

    return null;
  }

  private async revokeToken(tokenId: string | null) {
    if (!tokenId) return;
    await this.tokens.update({ id: tokenId }, { usedAt: new Date() });
  }

  private findByEmailInsensitive(email: string) {
    return this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }

  private async authenticateUser(email: string, password: string) {
    const user = await this.findByEmailInsensitive(email);
    if (!user || !user.isActive) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    await this.users.update({ id: user.id }, { lastLoginAt: new Date(), updatedAt: new Date() });

    return user;
  }

  async login(data: z.infer<typeof loginSchema>) {
    const email = data.email.trim().toLowerCase();
    const user = await this.authenticateUser(email, data.password);
    if (!user) throw new AppError(401, 'Электрондук почта же сыр сөз туура эмес');
    if (user.role === 'admin') {
      throw new AppError(403, 'Админ үчүн /admin/login баракчасын колдонуңуз');
    }

    return { token: this.signToken({ id: user.id, role: user.role }), user: toPublicUser(user) };
  }

  async adminLogin(data: z.infer<typeof loginSchema>) {
    const email = data.email.trim().toLowerCase();
    const user = await this.authenticateUser(email, data.password);
    if (!user) throw new AppError(401, 'Электрондук почта же сыр сөз туура эмес');
    if (user.role !== 'admin') throw new AppError(403, 'Админ укугу жок');

    return { token: this.signToken({ id: user.id, role: user.role }), user: toPublicUser(user) };
  }

  /** Returns the HTTP status alongside the body: 201 for a new account, 200 when re-sending a code. */
  async register(data: z.infer<typeof registerSchema>) {
    const email = data.email.trim().toLowerCase();
    const phone = data.phone;
    const emailTaken = new AppError(409, 'Бул электрондук почта менен аккаунт бар', {
      fields: { email: 'Бул электрондук почта менен аккаунт бар' },
    });
    const codeNotSent = () =>
      new AppError(503, 'Код почтага жөнөтүлгөн жок. Кийинчерээк кайра кайталап көрүңүз.');

    const exists = await this.users.findOneBy({ email });
    if (exists) {
      if (exists.role === 'admin' || !exists.isActive || exists.isVerified) throw emailTaken;

      const { code, tokenId } = await this.issueAuthCode(exists.id);
      const delivered = await this.deliverAuthCode(email, exists.phone, code, 'register');
      if (!delivered) {
        await this.revokeToken(tokenId);
        throw codeNotSent();
      }
      return {
        status: 200,
        body: { needsConfirmation: true, email, message: deliveryMessage(delivered) },
      };
    }

    const phoneTaken = await findUserByKgPhone(this.ds, phone);
    if (phoneTaken) {
      throw new AppError(409, 'Бул телефон менен аккаунт бар', {
        fields: { phone: 'Бул телефон менен аккаунт бар' },
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.ds.transaction(async (em) => {
      const created = await em.save(
        em.create(User, {
          email,
          passwordHash,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone,
          role: 'user',
          isActive: true,
          isVerified: false,
          lastLoginAt: null,
        }),
      );
      await em.save(em.create(UserProfile, { userId: created.id }));
      return created;
    });

    const { code } = await this.issueAuthCode(user.id);
    const delivered = await this.deliverAuthCode(email, phone, code, 'register');
    if (!delivered) {
      await this.users.delete({ id: user.id });
      throw codeNotSent();
    }

    return {
      status: 201,
      body: { needsConfirmation: true, email, message: deliveryMessage(delivered) },
    };
  }

  async forgotPassword(data: z.infer<typeof forgotPasswordSchema>) {
    const email = data.email;
    const user = await this.findByEmailInsensitive(email);

    if (!user || !user.isActive || user.role === 'admin') {
      throw new AppError(400, 'Бул почта менен аккаунт жок', {
        fields: { email: 'Бул почта менен аккаунт жок' },
      });
    }

    const { code, tokenId } = await this.issueAuthCode(user.id);
    const delivered = await this.deliverAuthCode(email, user.phone, code, 'reset');
    if (!delivered) {
      await this.revokeToken(tokenId);
      throw new AppError(
        503,
        this.mail.isConfigured()
          ? 'Код почтага жөнөтүлгөн жок. Кийинчерээк кайра кайталап көрүңүз.'
          : 'Код почтага жөнөтүлгөн жок. Почта сервиси туташа элек.',
      );
    }

    return { message: deliveryMessage(delivered) };
  }

  async confirmCode(data: z.infer<typeof confirmCodeSchema>) {
    const invalid = () => new AppError(400, CODE_INVALID, { fields: { code: CODE_INVALID } });
    const code = data.code.trim();
    const user = await this.findByEmailInsensitive(data.email);
    if (!user || !user.isActive || user.role === 'admin') throw invalid();

    const record = await this.tokens.findOneBy({ token: code, usedAt: IsNull(), userId: user.id });
    if (!record || record.expiresAt < new Date()) throw invalid();

    const updated = await this.ds.transaction(async (em) => {
      user.isVerified = true;
      user.lastLoginAt = new Date();
      const saved = await em.save(user);
      await em.update(PasswordResetToken, { id: record.id }, { usedAt: new Date() });
      return saved;
    });

    return { token: this.signToken({ id: updated.id, role: updated.role }), user: toPublicUser(updated) };
  }

  async resetPassword(data: z.infer<typeof resetPasswordSchema>) {
    const invalid = () => new AppError(400, CODE_INVALID, { fields: { token: CODE_INVALID } });
    const token = data.token.trim();
    const user = await this.findByEmailInsensitive(data.email);
    if (!user || !user.isActive || user.role === 'admin') throw invalid();

    const record = await this.tokens.findOneBy({ token, usedAt: IsNull(), userId: user.id });
    if (!record || record.usedAt || record.expiresAt < new Date() || !user.isActive) {
      throw invalid();
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    await this.ds.transaction(async (em) => {
      await em.update(User, { id: user.id }, { passwordHash, isVerified: true, updatedAt: new Date() });
      await em.update(PasswordResetToken, { id: record.id }, { usedAt: new Date() });
    });

    return { message: 'Сыр сөз ийгиликтүү өзгөртүлдү' };
  }

  async me(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !user.isActive) throw new AppError(401, 'Колдонуучу табылган жок');
    return { user: toPublicUser(user) };
  }

  async updateMe(userId: string, data: z.infer<typeof updateProfileSchema>) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !user.isActive) throw new AppError(401, 'Колдонуучу табылган жок');

    if (data.email && data.email.trim().toLowerCase() !== user.email) {
      const emailTaken = await this.users.findOneBy({ email: data.email.trim().toLowerCase() });
      if (emailTaken) {
        throw new AppError(409, 'Бул электрондук почта ээсе болгон', {
          fields: { email: 'Бул электрондук почта ээсе болгон' },
        });
      }
    }

    if (data.phone && data.phone !== user.phone) {
      const phoneTaken = await findUserByKgPhone(this.ds, data.phone, user.id);
      if (phoneTaken) {
        throw new AppError(409, 'Бул телефон менен аккаунт бар', {
          fields: { phone: 'Бул телефон менен аккаунт бар' },
        });
      }
    }

    let passwordHash = user.passwordHash;
    if (data.currentPassword && data.newPassword) {
      const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!ok) {
        throw new AppError(400, 'Учурдагы сыр сөз туура эмес', {
          fields: { currentPassword: 'Учурдагы сыр сөз туура эмес' },
        });
      }
      passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    if (data.firstName !== undefined) user.firstName = data.firstName.trim();
    if (data.lastName !== undefined) user.lastName = data.lastName.trim();
    if (data.email !== undefined) user.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.newPassword) user.passwordHash = passwordHash;
    const updated = await this.users.save(user);

    return { user: toPublicUser(updated) };
  }
}
