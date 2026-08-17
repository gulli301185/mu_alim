import { useState, type InputHTMLAttributes } from 'react';
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
  const [visible, setVisible] = useState(false);

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
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="auth-modal-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Сыр сөздү жашыруу' : 'Сыр сөздү көрсөтүү'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      {hint && !error ? <span className="auth-modal-field-hint">{hint}</span> : null}
      {error ? <span className="auth-modal-field-error">{error}</span> : null}
    </label>
  );
}
