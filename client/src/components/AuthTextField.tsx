import { Mail, User, Phone, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, type InputHTMLAttributes } from 'react';

type AuthTextFieldProps = {
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'type'
  | 'name'
  | 'placeholder'
  | 'required'
  | 'autoComplete'
  | 'value'
  | 'onChange'
  | 'maxLength'
  | 'inputMode'
>;

export function AuthTextField({
  label,
  icon: Icon,
  type = 'text',
  name,
  placeholder,
  required,
  autoComplete,
  value,
  onChange,
  error,
  hint,
  maxLength,
  inputMode,
}: AuthTextFieldProps) {
  const messageId = useId();
  return (
    <label className="auth-modal-field">
      <span className="auth-modal-label">{label}</span>
      <span className={`auth-modal-input-group${error ? ' auth-modal-input-group-invalid' : ''}`}>
        <span className="auth-modal-input-icon-box" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <input
          type={type}
          name={name}
          className="auth-modal-input"
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          value={value}
          onChange={onChange}
        />
      </span>
      {/* toi */}
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

export { Mail, User, Phone, KeyRound };
