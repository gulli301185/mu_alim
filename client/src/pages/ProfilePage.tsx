import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, User, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserDisplayName } from '../lib/auth-api';
import { getErrorMessage, toastError, toastSuccess } from '../lib/toast';
import { PasswordField } from '../components/PasswordField';

export function ProfilePage() {
  const { user, loading, updateProfile, logout } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPhone(user.phone ?? '');
  }, [user]);

  if (loading) {
    return (
      <section className="profile-page">
        <div className="wrap profile-page-wrap">
          <div className="ui-card profile-card">
            <p>Жүктөлүүдө...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
      toastError('Жаңы сыр сөздөр дал келген жок');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        ...(newPassword
          ? { currentPassword, newPassword }
          : {}),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Профиль ийгиликтүү жаңыртылды');
      toastSuccess('Профиль ийгиликтүү жаңыртылды');
    } catch (err) {
      toastError(getErrorMessage(err, 'Жаңыртуу ийгиликсиз'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile-page">
      <div className="wrap profile-page-wrap">
        <header className="profile-page-header">
          <div>
            <p className="profile-page-kicker">Жеке кабинет</p>
            <h1 className="profile-page-title">{getUserDisplayName(user)}</h1>
            <p className="profile-page-subtitle">{user.email}</p>
          </div>
        </header>

        <div className="profile-grid">
          <aside className="ui-card profile-summary">
            <div className="profile-avatar">{user.firstName.charAt(0).toUpperCase()}</div>
            <h2 className="profile-summary-name">{getUserDisplayName(user)}</h2>
            <p className="profile-summary-email">{user.email}</p>
            {user.phone ? <p className="profile-summary-phone">{user.phone}</p> : null}
            <p className="profile-summary-role">Колдонуучу</p>
            <button type="button" className="profile-logout-btn" onClick={logout}>
              Чыгуу (Logout)
            </button>
            <Link to="/questions" className="profile-link-btn">
              Суроо-жооп бөлүмүнө
            </Link>
          </aside>

          <form className="ui-card profile-form" onSubmit={(e) => void handleSubmit(e)}>
            <h2 className="profile-form-title">Профиль маалыматтары</h2>

            {success ? <p className="profile-success">{success}</p> : null}

            <div className="profile-form-grid">
              <label className="auth-modal-field">
                <span className="auth-modal-label">Атыңыз</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    className="auth-modal-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
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
                    className="auth-modal-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </span>
              </label>

              <label className="auth-modal-field profile-form-full">
                <span className="auth-modal-label">Электрондук почта</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    className="auth-modal-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </span>
              </label>

              <label className="auth-modal-field profile-form-full">
                <span className="auth-modal-label">Телефон</span>
                <span className="auth-modal-input-group">
                  <span className="auth-modal-input-icon-box" aria-hidden>
                    <Phone className="h-4 w-4" />
                  </span>
                  <input
                    type="tel"
                    className="auth-modal-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </span>
              </label>
            </div>

            <div className="profile-password-block">
              <h3 className="profile-form-subtitle">Сыр сөздү өзгөртүү (милдеттүү эмес)</h3>
              <PasswordField
                label="Учурдагы сыр сөз"
                name="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <PasswordField
                label="Жаңы сыр сөз"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
              <PasswordField
                label="Жаңы сыр сөздү кайталаңыз"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-gold profile-save-btn" disabled={saving}>
              {saving ? 'Сакталууда...' : 'Сактоо'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
