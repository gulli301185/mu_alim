import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import { AuthTextField } from '../components/AuthTextField';
import { AuthApiError } from '../lib/auth-api';
import { formatZodErrors, firstZodError, loginSchema, type FieldErrors } from '../lib/auth-validation';

export function AdminLoginPage() {
  const { loginAdmin, isAdmin, loading, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({ email: '', password: '' });

  if (!loading && isAdmin) {
    return <Navigate to="/questions" replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      setError(firstZodError(parsed.error));
      return;
    }

    try {
      await loginAdmin(parsed.data);
      navigate('/questions', { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Кирүү ийгиликсиз');
      }
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

          {error ? <p className="auth-modal-error">{error}</p> : null}

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

          <p className="admin-login-back">
            <Link to="/">← Башкы бетке кайтуу</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
