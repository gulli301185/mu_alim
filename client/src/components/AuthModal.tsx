import { useEffect, useState, type FormEvent } from 'react';
import { X, Mail, Lock, User, Phone } from 'lucide-react';
import { SITE } from '../data/landing';
import { useAuth } from '../context/AuthContext';

type AuthTab = 'login' | 'register';

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
};

export function AuthModal({ open, onClose, initialTab = 'login' }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
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

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    try {
      await login({ email, password });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Кирүү ийгиликсиз');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const firstName = (form.elements.namedItem('firstName') as HTMLInputElement).value.trim();
    const lastName = (form.elements.namedItem('lastName') as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const phone = (form.elements.namedItem('phone') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

    if (password !== confirm) {
      setError('Сыр сөздөр дал келген жок');
      return;
    }

    setLoading(true);
    try {
      await register({ firstName, lastName, email, phone: phone || undefined, password });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Каттоо ийгиликсиз');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Жабуу">
          <X className="h-5 w-5" />
        </button>

        <div className="auth-modal-head">
          <img src="/logo-mualim.png" alt="" className="auth-modal-logo" aria-hidden />
          <h2 id="auth-modal-title" className="auth-modal-title">
            {SITE.name}
          </h2>
          <p className="auth-modal-subtitle">{SITE.tagline}</p>
        </div>

        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-modal-tab${tab === 'login' ? ' auth-modal-tab-active' : ''}`}
            onClick={() => {
              setTab('login');
              setError(null);
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-modal-tab${tab === 'register' ? ' auth-modal-tab-active' : ''}`}
            onClick={() => {
              setTab('register');
              setError(null);
            }}
          >
            Register
          </button>
        </div>

        <div className="auth-modal-body">
          {error ? <p className="auth-modal-error">{error}</p> : null}

          {tab === 'login' ? (
            <form className="auth-modal-form" onSubmit={(e) => void handleLogin(e)}>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Email</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    name="email"
                    className="auth-modal-input"
                    placeholder="admin@mualim.academy"
                    required
                    autoComplete="email"
                  />
                </span>
              </label>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Сыр сөз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    name="password"
                    className="auth-modal-input"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </span>
              </label>
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={loading}>
                {loading ? 'Кирүүдө...' : 'Login'}
              </button>
              <p className="auth-modal-switch">
                Аккаунтуңуз жокпу?{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => setTab('register')}>
                  Register
                </button>
              </p>
            </form>
          ) : (
            <form className="auth-modal-form" onSubmit={(e) => void handleRegister(e)}>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Атыңыз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    name="firstName"
                    className="auth-modal-input"
                    placeholder="Атыңыз"
                    required
                    autoComplete="given-name"
                  />
                </span>
              </label>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Фамилияңыз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    name="lastName"
                    className="auth-modal-input"
                    placeholder="Фамилияңыз"
                    required
                    autoComplete="family-name"
                  />
                </span>
              </label>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Email</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    name="email"
                    className="auth-modal-input"
                    placeholder="email@example.com"
                    required
                    autoComplete="email"
                  />
                </span>
              </label>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Телефон</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    className="auth-modal-input"
                    placeholder="+996 500 000 000"
                    autoComplete="tel"
                  />
                </span>
              </label>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Сыр сөз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    name="password"
                    className="auth-modal-input"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </span>
              </label>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Сыр сөздү кайталаңыз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="auth-modal-input"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </span>
              </label>
              <button type="submit" className="btn-gold auth-modal-submit w-full" disabled={loading}>
                {loading ? 'Катталууда...' : 'Register'}
              </button>
              <p className="auth-modal-switch">
                Аккаунтуңуз барбы?{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => setTab('login')}>
                  Login
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
