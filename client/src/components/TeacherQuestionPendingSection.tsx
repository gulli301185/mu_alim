import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAdminTeacherQuestions,
  publishTeacherQuestionAnswer,
  type AdminTeacherQuestion,
} from '../lib/admin-teacher-questions-api';
import { getErrorMessage, toastError, toastSuccess } from '../lib/toast';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ky-KG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PendingQuestionRow({
  item,
  token,
  onPublished,
}: {
  item: AdminTeacherQuestion;
  token: string;
  onPublished: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    if (!answer.trim()) {
      toastError('Жооп жазыңыз');
      return;
    }

    setLoading(true);
    try {
      const result = await publishTeacherQuestionAnswer(token, item.id, answer.trim());
      toastSuccess(result.message);
      onPublished();
    } catch (err) {
      toastError(getErrorMessage(err, 'Жариялоо ийгиликсиз'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <li className="qa-admin-row qa-admin-row-pending ui-card">
      <div className="qa-admin-row-main">
        <span className="qa-admin-row-num">{item.questionNumber ?? '—'}</span>
        <div className="qa-admin-row-pending-body">
          <p className="qa-admin-row-text">{item.question}</p>
          <p className="qa-admin-row-pending-meta">
            {item.name} · {formatDate(item.createdAt)}
          </p>
        </div>
      </div>
      <div className="qa-admin-row-actions">
        <button
          type="button"
          className="btn-gold qa-admin-btn"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Жабуу' : 'Жооп берүү'}
        </button>
      </div>

      {open ? (
        <div className="qa-admin-row-pending-form">
          <label className="qa-admin-field">
            <span className="qa-admin-label">
              {item.questionNumber != null ? `${item.questionNumber}-суроо жооп` : 'Жооп'}
            </span>
            <textarea
              className="qa-admin-textarea"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Жоопту бул жерге жазыңыз..."
              required
            />
          </label>
          <div className="qa-admin-form-actions">
            <button
              type="button"
              className="btn-gold qa-admin-btn"
              disabled={loading}
              onClick={() => void handlePublish()}
            >
              {loading ? 'Жарияланууда...' : 'Суроо-жоопко жариялоо'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function TeacherQuestionPendingSection({ onPublished }: { onPublished?: () => void }) {
  const { token } = useAuth();
  const [items, setItems] = useState<AdminTeacherQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchAdminTeacherQuestions(token, {
        status: 'pending',
        limit: 50,
      });
      setItems(data.items);
    } catch (err) {
      toastError(getErrorMessage(err, 'Күтүүдөгү суроолор жүктөлгөн жок'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePublished = () => {
    void load();
    onPublished?.();
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="qa-admin-pending-section" aria-label="Күтүүдөгү суроолор">
      <header className="qa-admin-pending-head">
        <h2 className="qa-admin-pending-title">Күтүүдөгү суроолор</h2>
        <span className="qa-admin-pending-badge">{items.length}</span>
      </header>
      <ul className="qa-admin-list">
        {items.map((item) => (
          <PendingQuestionRow
            key={item.id}
            item={item}
            token={token!}
            onPublished={handlePublished}
          />
        ))}
      </ul>
    </section>
  );
}
