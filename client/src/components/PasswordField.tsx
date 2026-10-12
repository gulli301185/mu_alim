import { useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock } from 'lucide-react';

type PasswordFieldProps = {
  label: string;
  error?: string;
  hint?: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'placeholder' | 'required' | 'minLength' | 'autoComplete' | 'value' | 'onChange'
>;

export function PasswordField({
  label,
  name,
  placeholder = '••••••••',
  required,
  minLength,
  autoComplete,
  value,
  onChange,
  error,
  hint,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const messageId = useId();

  return (
    <label className="auth-modal-field">
      <span className="auth-modal-label">{label}</span>
      <span className={`auth-modal-input-group auth-modal-input-group-password${error ? ' auth-modal-input-group-invalid' : ''}`}>
        <span className="auth-modal-input-icon-box" aria-hidden>
          <Lock className="h-4 w-4" />
        </span>
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          className="auth-modal-input"
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="auth-modal-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {hint && !error ? (
        <span id={messageId} className="auth-modal-field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={messageId} className="auth-modal-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
