import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from './PasswordField';
import { AuthTextField, Mail, User, Phone } from './AuthTextField';
import { AuthApiError } from '../lib/auth-api';
import {
  forgotPasswordSchema,
  formatZodErrors,
  firstZodError,
  loginSchema,
  registerSchema,
  type FieldErrors,
} from '../lib/auth-validation';

type AuthTab = 'login' | 'register' | 'forgot';

type UserAuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
};

const PASSWORD_HINT = 'Кеминде 8 символ, тамга жана сан';

export function UserAuthModal({ open, onClose, initialTab = 'login' }: UserAuthModalProps) {
  const { loginUser, register, forgotPassword, isLoggingIn, isRegistering } = useAuth();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotResetUrl, setForgotResetUrl] = useState<string | null>(null);

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
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setFieldErrors({});
      setForgotMessage(null);
      setForgotResetUrl(null);
    }
  }, [open, initialTab]);

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
    setError(null);
    setFieldErrors({});
    setForgotMessage(null);
    setForgotResetUrl(null);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse(loginForm);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      setError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      await loginUser(parsed.data);
      onClose();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Кирүү ийгиликсиз');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = registerSchema.safeParse(registerForm);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      setError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      await register({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone || undefined,
        password: parsed.data.password,
      });
      onClose();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Каттоо ийгиликсиз');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setForgotMessage(null);
    setForgotResetUrl(null);

    const parsed = forgotPasswordSchema.safeParse({ email: forgotEmail });
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      setError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPassword(parsed.data.email);
      setForgotMessage(result.message);
      if (result.resetUrl) setForgotResetUrl(result.resetUrl);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Сурам ийгиликсиз');
      }
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
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Жабуу">
          <X className="h-5 w-5" />
        </button>

        <div className="auth-modal-head">
          <img src="/logo-mualim.png" alt="" className="auth-modal-logo" aria-hidden />
          <h2 id="user-auth-modal-title" className="auth-modal-title">
            {tab === 'forgot' ? 'Сыр сөздү калыбына келтирүү' : 'Колдонуучу каттоосу'}
          </h2>
          <p className="auth-modal-subtitle">
            {tab === 'forgot'
              ? 'Электрондук почта дарегиңизди киргизиңиз'
              : 'Кирүү же жаңы аккаунт түзүү'}
          </p>
        </div>

        {tab !== 'forgot' ? (
          <div className="auth-modal-tabs">
            <button
              type="button"
              className={`auth-modal-tab${tab === 'login' ? ' auth-modal-tab-active' : ''}`}
              onClick={() => switchTab('login')}
            >
              Кирүү
            </button>
            <button
              type="button"
              className={`auth-modal-tab${tab === 'register' ? ' auth-modal-tab-active' : ''}`}
              onClick={() => switchTab('register')}
            >
              Катталуу
            </button>
          </div>
        ) : null}

        <div className="auth-modal-body" ref={bodyRef}>
          {error ? <p className="auth-modal-error">{error}</p> : null}
          {forgotMessage ? <p className="auth-modal-success">{forgotMessage}</p> : null}
          {forgotResetUrl ? (
            <p className="auth-modal-dev-link">
              Өнүктүрүү: <a href={forgotResetUrl}>Шилтемени ачуу</a>
            </p>
          ) : null}

          {tab === 'login' ? (
            <form className="auth-modal-form" onSubmit={(e) => void handleLogin(e)} noValidate>
              <AuthTextField
                label="Электрондук почта"
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
                label="Сыр сөз"
                name="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                error={fieldErrors.password}
              />
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={isLoggingIn}>
                {isLoggingIn ? 'Кирүүдө...' : 'Кирүү'}
              </button>
              <p className="auth-modal-switch">
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('forgot')}>
                  Сыр сөздү унуттуңузбу?
                </button>
              </p>
              <p className="auth-modal-switch">
                Аккаунтуңуз жокпу?{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('register')}>
                  Катталуу
                </button>
              </p>
            </form>
          ) : tab === 'register' ? (
            <form className="auth-modal-form auth-modal-form-register" onSubmit={(e) => void handleRegister(e)} noValidate>
              <div className="auth-modal-name-row">
                <AuthTextField
                  label="Атыңыз"
                  icon={User}
                  name="firstName"
                  placeholder="Атыңыз"
                  autoComplete="given-name"
                  value={registerForm.firstName}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, firstName: e.target.value }))}
                  error={fieldErrors.firstName}
                />
                <AuthTextField
                  label="Фамилияңыз"
                  icon={User}
                  name="lastName"
                  placeholder="Фамилияңыз"
                  autoComplete="family-name"
                  value={registerForm.lastName}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, lastName: e.target.value }))}
                  error={fieldErrors.lastName}
                />
              </div>
              <AuthTextField
                label="Электрондук почта"
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
                label="Телефон"
                icon={Phone}
                type="tel"
                name="phone"
                placeholder="+996 500 000 000"
                autoComplete="tel"
                value={registerForm.phone}
                onChange={(e) => setRegisterForm((f) => ({ ...f, phone: e.target.value }))}
                error={fieldErrors.phone}
                hint="Милдеттүү эмес"
              />
              <div className="auth-modal-password-row">
                <PasswordField
                  label="Сыр сөз"
                  name="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                  error={fieldErrors.password}
                  hint={PASSWORD_HINT}
                />
                <PasswordField
                  label="Сыр сөздү кайталаңыз"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  error={fieldErrors.confirmPassword}
                />
              </div>
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={isRegistering}>
                {isRegistering ? 'Катталууда...' : 'Катталуу'}
              </button>
              <p className="auth-modal-switch">
                Аккаунтуңуз барбы?{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('login')}>
                  Кирүү
                </button>
              </p>
            </form>
          ) : (
            <form className="auth-modal-form" onSubmit={(e) => void handleForgot(e)} noValidate>
              <AuthTextField
                label="Электрондук почта"
                icon={Mail}
                type="email"
                name="email"
                placeholder="email@example.com"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                error={fieldErrors.email}
              />
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={loading}>
                {loading ? 'Жиберилүүдө...' : 'Шилтеме алуу'}
              </button>
              <p className="auth-modal-switch">
                <button type="button" className="auth-modal-switch-btn" onClick={() => switchTab('login')}>
                  ← Кирүүгө кайтуу
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
