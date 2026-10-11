import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthApiError } from '../lib/auth-api';
import { getErrorMessage, toastError, toastSuccess } from '../lib/toast';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import { AuthTextField, Mail, KeyRound } from '../components/AuthTextField';
import {
  formatZodErrors,
  firstZodError,
  resetPasswordSchema,
  type FieldErrors,
} from '../lib/auth-validation';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    token: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setSuccess(null);

    const parsed = resetPasswordSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(parsed.data);
      setSuccess(result.message);
      toastSuccess(result.message);
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, t('auth.passwordChangeFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="admin-login-page">
      <div className="wrap admin-login-wrap">
        <div className="ui-card admin-login-card">
          <div className="admin-login-head">
            <h1 className="admin-login-title">{t('resetPage.title')}</h1>
            <p className="admin-login-subtitle">{t('resetPage.subtitle')}</p>
          </div>

          {success ? <p className="auth-modal-success">{success}</p> : null}

          <form className="auth-modal-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
            <AuthTextField
              label={t('auth.emailLabel')}
              icon={Mail}
              type="email"
              name="email"
              placeholder="email@example.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={fieldErrors.email}
            />
            <AuthTextField
              label={t('auth.codeLabel')}
              icon={KeyRound}
              name="token"
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={form.token}
              onChange={(e) =>
                setForm((f) => ({ ...f, token: e.target.value.replace(/\D/g, '').slice(0, 6) }))
              }
              error={fieldErrors.token}
              hint={t('auth.resetCodeHint')}
            />
            <PasswordField
              label={t('auth.newPassword')}
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={fieldErrors.password}
              hint={t('auth.passwordHint')}
            />
            <PasswordField
              label={t('auth.confirmPasswordLabel')}
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              error={fieldErrors.confirmPassword}
            />
            <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={loading || Boolean(success)}>
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </form>

          <p className="admin-login-back">
            <Link to="/">← {t('common.back')}</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
