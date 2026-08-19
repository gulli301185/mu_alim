import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type AdminSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AdminSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
};

export function AdminSelect({
  value,
  onChange,
  options,
  placeholder = 'Тандаңыз...',
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
}: AdminSelectProps) {
  const autoId = useId();
  const listboxId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`admin-select${open ? ' admin-select-open' : ''}${disabled ? ' admin-select-disabled' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        id={listboxId}
        className="admin-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
      >
        <span className={selected ? 'admin-select-value' : 'admin-select-placeholder'}>
          {displayLabel}
        </span>
        <ChevronDown className="admin-select-chevron" aria-hidden />
      </button>

      {open ? (
        <ul className="admin-select-menu" role="listbox" aria-labelledby={listboxId}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || '__empty'} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`admin-select-option${isSelected ? ' admin-select-option-active' : ''}`}
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return;
                    handleSelect(option.value);
                  }}
                >
                  <span className="admin-select-option-label">{option.label}</span>
                  {isSelected ? <Check className="admin-select-option-check" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
