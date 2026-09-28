import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PasswordField } from '../PasswordField';
import { getErrorMessage, toastError, toastSuccess } from '../../lib/toast';

/** Lets a signed-in admin change their own password from the dashboard. */
export function AdminPasswordModal({ onClose }: { onClose: () => void }) {
  const { updateProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toastError('Жаңы сыр сөз кеминде 8 символдон турушу керек');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Жаңы сыр сөздөр дал келген жок');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      toastSuccess('Сыр сөз ийгиликтүү өзгөртүлдү');
      onClose();
    } catch (err) {
      toastError(getErrorMessage(err, 'Сыр сөздү өзгөртүү ийгиликсиз'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="presentation">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="Жабуу" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
        <h2 className="auth-modal-title">Сыр сөздү өзгөртүү</h2>
        <form className="auth-modal-form" onSubmit={(e) => void handleSubmit(e)}>
          <PasswordField
            label="Учурдагы сыр сөз"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <PasswordField
            label="Жаңы сыр сөз"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordField
            label="Жаңы сыр сөздү кайталаңыз"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button type="submit" className="auth-modal-submit" disabled={saving}>
            {saving ? 'Сакталууда...' : 'Сактоо'}
          </button>
        </form>
      </div>
    </div>
  );
}
