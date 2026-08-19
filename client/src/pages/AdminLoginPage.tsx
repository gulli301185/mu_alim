import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Mail, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import { AuthTextField } from '../components/AuthTextField';
import { AuthApiError } from '../lib/auth-api';
import { formatZodErrors, firstZodError, loginSchema, type FieldErrors } from '../lib/auth-validation';
import { getErrorMessage, toastError } from '../lib/toast';

export function AdminLoginPage() {
  const { loginAdmin, isAdmin, loading, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({ email: '', password: '' });

  if (!loading && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      toastError(firstZodError(parsed.error));
      return;
    }

    try {
      await loginAdmin(parsed.data);
      navigate('/admin', { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError && err.fields) setFieldErrors(err.fields);
      toastError(getErrorMessage(err, 'Кирүү ийгиликсиз'));
    }
  };

  return (
    <section className="admin-login-page">
      <div className="wrap admin-login-wrap">
        <div className="ui-card admin-login-card">
          <div className="admin-login-head">
            <span className="admin-login-icon" aria-hidden>
              <Shield className="h-8 w-8" />
            </span>
            <h1 className="admin-login-title">Админ кирүү</h1>
            <p className="admin-login-subtitle">Суроо-жооп бөлүмүн башкаруу</p>
          </div>

          <form className="auth-modal-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
            <AuthTextField
              label="Админ электрондук почтасы"
              icon={Mail}
              type="email"
              name="email"
              placeholder="admin@mualim.academy"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={fieldErrors.email}
            />
            <PasswordField
              label="Сыр сөз"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={fieldErrors.password}
            />
            <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={isLoggingIn || loading}>
              {isLoggingIn ? 'Кирүүдө...' : 'Кирүү'}
            </button>
          </form>

        </div>
      </div>
    </section>
  );
}
