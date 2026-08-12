import { useEffect, useState, type FormEvent } from 'react';
import { X, Mail, Lock, User, Phone } from 'lucide-react';
import { SITE } from '../data/landing';

type AuthTab = 'login' | 'register';

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
};

export function AuthModal({ open, onClose, initialTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
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

  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onClose();
  };

  const handleRegister = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;
    if (password !== confirm) {
      const confirmInput = form.elements.namedItem('confirmPassword') as HTMLInputElement;
      confirmInput.setCustomValidity('Сыр сөздөр дал келген жок');
      form.reportValidity();
      return;
    }
    onClose();
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
          <img
            src="/logo-mualim.png"
            alt=""
            className="auth-modal-logo"
            aria-hidden
          />
          <h2 id="auth-modal-title" className="auth-modal-title">
            {SITE.name}
          </h2>
          <p className="auth-modal-subtitle">{SITE.tagline}</p>
        </div>

        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-modal-tab${tab === 'login' ? ' auth-modal-tab-active' : ''}`}
            onClick={() => setTab('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-modal-tab${tab === 'register' ? ' auth-modal-tab-active' : ''}`}
            onClick={() => setTab('register')}
          >
            Register
          </button>
        </div>

        <div className="auth-modal-body">
          {tab === 'login' ? (
            <form className="auth-modal-form" onSubmit={handleLogin}>
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
              <button type="submit" className="btn-gold auth-modal-submit w-full">
                Login
              </button>
              <p className="auth-modal-switch">
                Аккаунтуңуз жокпу?{' '}
                <button type="button" className="auth-modal-switch-btn" onClick={() => setTab('register')}>
                  Register
                </button>
              </p>
            </form>
          ) : (
            <form className="auth-modal-form" onSubmit={handleRegister}>
              <label className="auth-modal-field">
                <span className="auth-modal-label">Атыңыз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    name="name"
                    className="auth-modal-input"
                    placeholder="Толук атыңыз"
                    required
                    autoComplete="name"
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
                    required
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
              <button type="submit" className="btn-gold auth-modal-submit w-full">
                Register
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
