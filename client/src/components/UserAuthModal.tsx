import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSiteImages } from '../context/SiteImagesContext';
import { SITE_IMAGE_KEYS } from '../lib/site-images-api';
import { PasswordField } from './PasswordField';
import { AuthTextField, Mail, User, Phone, KeyRound } from './AuthTextField';
import { AuthApiError } from '../lib/auth-api';
import { getErrorMessage, toastError, toastSuccess } from '../lib/toast';
import {
  confirmCodeSchema,
  forgotPasswordSchema,
  formatZodErrors,
  firstZodError,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type FieldErrors,
} from '../lib/auth-validation';

type AuthTab = 'login' | 'register' | 'forgot';

type UserAuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
};

export function UserAuthModal({ open, onClose, initialTab = 'login' }: UserAuthModalProps) {
  const { t } = useTranslation();
  const PASSWORD_HINT = t('auth.passwordHint');
  const { loginUser, register, confirmCode, forgotPassword, resetPassword, isLoggingIn, isRegistering } = useAuth();
  const { image } = useSiteImages();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [registerStep, setRegisterStep] = useState<'form' | 'code'>('form');
  const [registerCode, setRegisterCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ token: '', password: '', confirmPassword: '' });
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setFieldErrors({});
      setForgotMessage(null);
      setForgotStep('email');
      setRegisterStep('form');
      setRegisterCode('');
      setResendIn(0);
      setResetForm({ token: '', password: '', confirmPassword: '' });
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => setResendIn((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setFieldErrors({});
    setForgotMessage(null);
    setForgotStep('email');
    setRegisterStep('form');
    setRegisterCode('');
    setResendIn(0);
    setResetForm({ token: '', password: '', confirmPassword: '' });
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = loginSchema.safeParse(loginForm);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      await loginUser(parsed.data);
      onClose();
    } catch (err) {
      if (err instanceof AuthApiError && err.needsConfirmation) {
        setTab('register');
        setRegisterStep('code');
        setRegisterForm((prev) => ({
          ...prev,
          email: err.email ?? loginForm.email,
          password: loginForm.password,
        }));
        setForgotMessage(err.message);
        toastError(err.message);
        return;
      }
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, t('auth.loginFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = registerSchema.safeParse(registerForm);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        password: parsed.data.password,
      });
      if (result?.needsConfirmation) {
        setForgotMessage(result.message);
        setRegisterStep('code');
        setResendIn(59);
        toastSuccess(result.message);
        return;
      }
      onClose();
    } catch (err) {
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, t('auth.registerFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    const parsed = confirmCodeSchema.safeParse({ email: registerForm.email, code: registerCode });
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }
    setLoading(true);
    try {
      await confirmCode(parsed.data);
      toastSuccess(t('auth.registeredSuccess'));
      onClose();
    } catch (err) {
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, t('auth.codeInvalid')));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (email: string) => {
    if (resendIn > 0 || !email) return;
    setLoading(true);
    try {
      const result = await forgotPassword({ email });
      setForgotMessage(result.message);
      setResendIn(59);
      toastSuccess(result.message);
    } catch (err) {
      toastError(getErrorMessage(err, t('auth.resendFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setForgotMessage(null);

    const parsed = forgotPasswordSchema.safeParse({ email: forgotEmail });
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPassword({ email: parsed.data.email });
      setForgotMessage(result.message);
      setResetForm({ token: '', password: '', confirmPassword: '' });
      setForgotStep('reset');
      setResendIn(59);
      toastSuccess(result.message);
    } catch (err) {
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, t('auth.requestFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = resetPasswordSchema.safeParse({
      email: forgotEmail,
      token: resetForm.token,
      password: resetForm.password,
      confirmPassword: resetForm.confirmPassword,
    });
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(parsed.data);
      toastSuccess(result.message);
      setLoginForm((form) => ({ ...form, password: '' }));
      switchTab('login');
    } catch (err) {
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, t('auth.passwordChangeFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`auth-modal${tab === 'register' ? ' auth-modal-register' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label={t('contact.close')}>
          <X className="h-5 w-5" />
        </button>

        <div className="auth-modal-head">
          <img src={image(SITE_IMAGE_KEYS.logo)} alt="" className="auth-modal-logo" aria-hidden />
          <h2 id="user-auth-modal-title" className="auth-modal-title">
            {tab === 'forgot' ? t('auth.resetTitle') : t('auth.registerTitle')}
          </h2>
          <p className="auth-modal-subtitle">
            {tab === 'forgot'
              ? forgotStep === 'reset'
                ? t('auth.resetSubtitleStep2')
                : t('auth.resetSubtitleStep1')
              : tab === 'register' && registerStep === 'code'
                ? t('auth.registerCodeSubtitle')
                : t('auth.defaultSubtitle')}
          </p>
        </div>

        {tab !== 'forgot' && !(tab === 'register' && registerStep === 'code') ? (
          <div className="auth-modal-tabs">
            <button
              type="button"
              className={`auth-modal-tab${tab === 'login' ? ' auth-modal-tab-active' : ''}`}
              onClick={() => switchTab('login')}
            >
              {t('auth.loginTab')}
            </button>
            <button
              type="button"
              className={`auth-modal-tab${tab === 'register' ? ' auth-modal-tab-active' : ''}`}
              onClick={() => switchTab('register')}
            >
              {t('auth.registerTab')}
            </button>
          </div>
        ) : null}

        <div className="auth-modal-body" ref={bodyRef}>
          {tab === 'login' ? (
            <form className="auth-modal-form" onSubmit={(e) => void handleLogin(e)} noValidate>
              <AuthTextField
                label={t('auth.emailLabel')}
                icon={Mail}
                type="email"
                name="email"
                placeholder="email@example.com"
                autoComplete="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                error={fieldErrors.email}
              />
              <PasswordField
                label={t('auth.passwordLabel')}
                name="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                error={fieldErrors.password}
              />
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={isLoggingIn}>
                {isLoggingIn ? t('auth.loggingIn') : t('auth.login')}
              </button>
              <p className="auth-modal-switch">
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('forgot')}>
                  {t('auth.forgotPassword')}
                </button>
              </p>
              <p className="auth-modal-switch">
                {t('auth.noAccount')}{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('register')}>
                  {t('auth.register')}
                </button>
              </p>
            </form>
          ) : tab === 'register' && registerStep === 'code' ? (
            <form className="auth-modal-form" onSubmit={(e) => void handleConfirmRegister(e)} noValidate>
              {forgotMessage ? <p className="auth-modal-success">{forgotMessage}</p> : null}
              <AuthTextField
                label={t('auth.codeLabel')}
                icon={KeyRound}
                name="code"
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={registerCode}
                onChange={(e) => setRegisterCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={fieldErrors.code}
                hint={t('auth.codeHint', { email: registerForm.email })}
              />
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={loading || isRegistering}>
                {loading || isRegistering ? t('auth.verifying') : t('auth.confirmBtn')}
              </button>
              <p className="auth-modal-switch">
                {resendIn > 0 ? (
                  <span>{t('auth.resendCountdown', { sec: String(resendIn).padStart(2, '0') })}</span>
                ) : (
                  <button type="button" className="auth-modal-switch-btn" onClick={() => void handleResend(registerForm.email)}>
                    {t('auth.resendCode')}
                  </button>
                )}
              </p>
              <p className="auth-modal-switch">
                <button type="button" className="auth-modal-switch-btn" onClick={() => setRegisterStep('form')}>
                  {t('auth.backToForm')}
                </button>
              </p>
            </form>
          ) : tab === 'register' ? (
            <form className="auth-modal-form auth-modal-form-register" onSubmit={(e) => void handleRegister(e)} noValidate>
              <div className="auth-modal-name-row">
                <AuthTextField
                  label={t('auth.firstNameLabel')}
                  icon={User}
                  name="firstName"
                  placeholder={t('auth.firstNameLabel')}
                  autoComplete="given-name"
                  value={registerForm.firstName}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, firstName: e.target.value }))}
                  error={fieldErrors.firstName}
                />
                <AuthTextField
                  label={t('auth.lastNameLabel')}
                  icon={User}
                  name="lastName"
                  placeholder={t('auth.lastNameLabel')}
                  autoComplete="family-name"
                  value={registerForm.lastName}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, lastName: e.target.value }))}
                  error={fieldErrors.lastName}
                />
              </div>
              <AuthTextField
                label={t('auth.emailLabel')}
                icon={Mail}
                type="email"
                name="email"
                placeholder="email@example.com"
                autoComplete="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                error={fieldErrors.email}
              />
              <AuthTextField
                label={t('auth.phoneLabel')}
                icon={Phone}
                type="tel"
                name="phone"
                placeholder="+996 500 000 000"
                autoComplete="tel"
                value={registerForm.phone}
                onChange={(e) => setRegisterForm((f) => ({ ...f, phone: e.target.value }))}
                error={fieldErrors.phone}
                hint={t('auth.phoneHint')}
              />
              <div className="auth-modal-password-row">
                <PasswordField
                  label={t('auth.passwordLabel')}
                  name="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                  error={fieldErrors.password}
                  hint={PASSWORD_HINT}
                />
                <PasswordField
                  label={t('auth.confirmPasswordLabel')}
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  error={fieldErrors.confirmPassword}
                />
              </div>
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={isRegistering}>
                {isRegistering ? t('auth.registering') : t('auth.register')}
              </button>
              <p className="auth-modal-switch">
                {t('auth.haveAccount')}{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('login')}>
                  {t('auth.login')}
                </button>
              </p>
            </form>
          ) : (
            <form
              className="auth-modal-form"
              onSubmit={(e) => void (forgotStep === 'reset' ? handleReset(e) : handleForgot(e))}
              noValidate
            >
              <AuthTextField
                label={t('auth.emailLabel')}
                icon={Mail}
                type="email"
                name="email"
                placeholder="email@example.com"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                error={fieldErrors.email}
              />
              {forgotStep === 'reset' ? (
                <>
                  {forgotMessage ? <p className="auth-modal-success">{forgotMessage}</p> : null}
                  <AuthTextField
                    label={t('auth.codeLabel')}
                    icon={KeyRound}
                    name="token"
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={resetForm.token}
                    onChange={(e) =>
                      setResetForm((form) => ({
                        ...form,
                        token: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    error={fieldErrors.token}
                    hint={t('auth.resetCodeHint')}
                  />
                  <PasswordField
                    label={t('auth.newPassword')}
                    name="password"
                    autoComplete="new-password"
                    value={resetForm.password}
                    onChange={(e) => setResetForm((form) => ({ ...form, password: e.target.value }))}
                    error={fieldErrors.password}
                    hint={PASSWORD_HINT}
                  />
                  <PasswordField
                    label={t('auth.confirmPasswordLabel')}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={resetForm.confirmPassword}
                    onChange={(e) =>
                      setResetForm((form) => ({ ...form, confirmPassword: e.target.value }))
                    }
                    error={fieldErrors.confirmPassword}
                  />
                </>
              ) : null}
              {forgotStep === 'reset' ? (
                <p className="auth-modal-switch">
                  {resendIn > 0 ? (
                    <span>{t('auth.resendCountdown', { sec: String(resendIn).padStart(2, '0') })}</span>
                  ) : (
                    <button type="button" className="auth-modal-switch-btn" onClick={() => void handleResend(forgotEmail)}>
                      {t('auth.resendCode')}
                    </button>
                  )}
                </p>
              ) : null}
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={loading}>
                {loading
                  ? forgotStep === 'reset'
                    ? t('auth.saving')
                    : t('auth.sending')
                  : forgotStep === 'reset'
                    ? t('auth.changePassword')
                    : t('auth.getCode')}
              </button>
              <p className="auth-modal-switch">
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('login')}>
                  {t('auth.backToLogin')}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
