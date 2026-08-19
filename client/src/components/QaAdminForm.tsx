import { useState, type FormEvent } from 'react';
import { getErrorMessage, toastError } from '../lib/toast';

export type QaFormValues = {
  question: string;
  answer: string;
  number?: number;
};

type QaAdminFormProps = {
  initial?: QaFormValues;
  submitLabel: string;
  onSubmit: (values: QaFormValues) => Promise<void>;
  onCancel?: () => void;
  variant?: 'inline' | 'modal';
};

export function QaAdminForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  variant = 'inline',
}: QaAdminFormProps) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        question: question.trim(),
        answer: answer.trim(),
        number: number.trim() ? Number(number) : undefined,
      });
    } catch (err) {
      toastError(getErrorMessage(err, 'Ката кетти'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className={variant === 'modal' ? 'admin-lesson-form' : 'qa-admin-form ui-card'}
      onSubmit={(e) => void handleSubmit(e)}
    >

      <label className="qa-admin-field">
        <span className="qa-admin-label">Суроо</span>
        <textarea
          className="qa-admin-textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          required
        />
      </label>

      <label className="qa-admin-field">
        <span className="qa-admin-label">Жооп</span>
        <textarea
          className="qa-admin-textarea"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={5}
          required
        />
      </label>

      <label className="qa-admin-field qa-admin-field-num">
        <span className="qa-admin-label">Номер (милдеттүү эмес)</span>
        <input
          type="number"
          className="qa-admin-input"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          min={1}
        />
      </label>

      <div className="qa-admin-form-actions">
        {onCancel ? (
          <button type="button" className="qa-admin-btn qa-admin-btn-muted" onClick={onCancel}>
            {variant === 'modal' ? 'Жокко чыгаруу' : 'Жабуу'}
          </button>
        ) : null}
        <button type="submit" className="btn-gold qa-admin-btn" disabled={loading}>
          {loading ? 'Сакталууда...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
