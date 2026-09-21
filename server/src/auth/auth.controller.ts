import { Body, Controller, Get, HttpCode, Post, Put, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import {
  confirmCodeSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../lib/auth-validation';
import { AuthService } from './auth.service';

const formErrors = { fields: true } as const;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema, formErrors)) body: z.infer<typeof loginSchema>) {
    return this.auth.login(body);
  }

  @Post('admin/login')
  @HttpCode(200)
  adminLogin(@Body(new ZodPipe(loginSchema, formErrors)) body: z.infer<typeof loginSchema>) {
    return this.auth.adminLogin(body);
  }

  @Post('register')
  async register(
    @Body(new ZodPipe(registerSchema, formErrors)) body: z.infer<typeof registerSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { status, body: payload } = await this.auth.register(body);
    res.status(status);
    return payload;
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(
    @Body(new ZodPipe(forgotPasswordSchema, formErrors)) body: z.infer<typeof forgotPasswordSchema>,
  ) {
    return this.auth.forgotPassword(body);
  }

  @Post('confirm-code')
  @HttpCode(200)
  confirmCode(@Body(new ZodPipe(confirmCodeSchema, formErrors)) body: z.infer<typeof confirmCodeSchema>) {
    return this.auth.confirmCode(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(
    @Body(new ZodPipe(resetPasswordSchema, formErrors)) body: z.infer<typeof resetPasswordSchema>,
  ) {
    return this.auth.resetPassword(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateProfileSchema, formErrors)) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.auth.updateMe(user.id, body);
  }
}
