import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ClipboardList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminCourses } from '../../lib/admin-courses-api';
import {
  CHOICE_LABELS,
  createAdminTest,
  deleteAdminTest,
  emptyChoiceQuestion,
  emptyTextQuestion,
  fetchAdminTest,
  fetchAdminTests,
  updateAdminTest,
  type AdminTestDetail,
  type AdminTestListItem,
  type CreateTestQuestionInput,
} from '../../lib/admin-tests-api';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { getErrorMessage, toastError } from '../../lib/toast';

type PaidCourseOption = { slug: string; title: string };

function toCreateQuestions(questions: CreateTestQuestionInput[]): CreateTestQuestionInput[] {
  return questions.map((q) => {
    if (q.questionType === 'choice') {
      return {
        questionType: 'choice' as const,
        questionText: q.questionText.trim(),
        options: q.options.map((o) => ({
          optionText: o.optionText.trim(),
          isCorrect: o.isCorrect,
          optionOrder: o.optionOrder,
        })),
      };
    }
    return {
      questionType: 'text' as const,
      questionText: q.questionText.trim(),
      correctTextAnswer: q.correctTextAnswer.trim(),
    };
  });
}

function detailToFormQuestions(test: AdminTestDetail): CreateTestQuestionInput[] {
  return test.questions.map((q) => {
    if (q.questionType === 'choice') {
      return {
        questionType: 'choice',
        questionText: q.questionText,
        options: q.options.map((o) => ({
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          optionOrder: o.optionOrder,
        })),
      };
    }
    return {
      questionType: 'text',
      questionText: q.questionText,
      correctTextAnswer: q.correctTextAnswer ?? '',
    };
  });
}

export function AdminTestsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<AdminTestListItem[]>([]);
  const [paidCourses, setPaidCourses] = useState<PaidCourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [courseSlug, setCourseSlug] = useState('');
  const [title, setTitle] = useState('');
  const [passingScore, setPassingScore] = useState('80');
  const [questions, setQuestions] = useState<CreateTestQuestionInput[]>([emptyChoiceQuestion()]);

  const coursesWithTest = useMemo(
    () => new Set(items.map((item) => item.course.slug)),
    [items],
  );

  const availableCourses = useMemo(
    () =>
      editingId
        ? paidCourses
        : paidCourses.filter((course) => !coursesWithTest.has(course.slug)),
    [paidCourses, editingId, coursesWithTest],
  );

  const showFormError = (message: string) => {
    toastError(message);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [testsData, coursesData] = await Promise.all([
        fetchAdminTests(token),
        fetchAdminCourses(token, { type: 'paid', limit: 100 }),
      ]);
      setItems(testsData.items);
      setPaidCourses(coursesData.items.map((c) => ({ slug: c.slug, title: c.title })));
    } catch (err) {
      toastError(getErrorMessage(err, 'Жүктөө ийгиликсиз'));
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setCourseSlug(paidCourses.find((c) => !coursesWithTest.has(c.slug))?.slug ?? paidCourses[0]?.slug ?? '');
    setTitle('');
    setPassingScore('80');
    setQuestions([emptyChoiceQuestion()]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = async (testId: string) => {
    if (!token) return;
    setSaving(true);
    try {
      const test = await fetchAdminTest(token, testId);
      setEditingId(test.id);
      setCourseSlug(test.course.slug);
      setTitle(test.title);
      setPassingScore(String(test.passingScore));
      setQuestions(detailToFormQuestions(test));
      setModalOpen(true);
    } catch (err) {
      toastError(getErrorMessage(err, 'Тест жүктөлбөдү'));
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!editingId && !courseSlug) {
      showFormError('Акылуу курсту тандаңыз');
      return;
    }

    const prepared = toCreateQuestions(questions);
    if (prepared.some((q) => !q.questionText)) {
      showFormError('Бардык суроолорду толтуруңуз');
      return;
    }

    for (const q of prepared) {
      if (q.questionType === 'choice') {
        if (q.options.some((o) => !o.optionText)) {
          showFormError('А, Б, В, Г варианттарын толтуруңуз');
          return;
        }
        if (q.options.filter((o) => o.isCorrect).length !== 1) {
          showFormError('Ар бир тандоо суроосунда бир туура жооп тандаңыз');
          return;
        }
      } else if (!q.correctTextAnswer) {
        showFormError('Текст суроосунун туура жообун жазыңыз');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim() || undefined,
        passingScore: Number(passingScore) || 80,
        questions: prepared,
      };

      if (editingId) {
        await updateAdminTest(token, editingId, payload);
      } else {
        await createAdminTest(token, { ...payload, courseRef: courseSlug });
      }

      closeModal();
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Сактоо ийгиликсиз'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (test: AdminTestListItem) => {
    if (!token) return;
    const ok = window.confirm(`"${test.title}" тестин өчүрөсүзбү?`);
    if (!ok) return;
    try {
      await deleteAdminTest(token, test.id);
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Өчүрүү ийгиликсиз'));
    }
  };

  const updateQuestion = (index: number, next: CreateTestQuestionInput) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? next : q)));
  };

  return (
    <section className="admin-users-page">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-section-title">Тесттер</h2>
          <p className="admin-section-subtitle">
            Акылуу курстар үчүн курстук финалдык тест · {items.length}
          </p>
        </div>
        <button type="button" className="btn-gold qa-admin-btn qa-admin-btn-add" onClick={openCreate}>
          <Plus className="h-5 w-5" />
          Жаңы курстук тест
        </button>
      </header>

      {error ? (
        <div className="qa-empty ui-card">
          <p>Жүктөлбөдү.</p>
          <button type="button" className="btn-gold qa-admin-btn" onClick={() => void load()}>
            Кайра жүктөө
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="qa-empty ui-card">
          <p>Жүктөлүүдө...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="qa-empty ui-card">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden />
          <p>
            Курстук тесттер жок. Акылуу курс тандап, бардык сабактар боюнча финалдык тест түзүңүз.
          </p>
        </div>
      ) : (
        <div className="admin-users-table-wrap ui-card">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Тест</th>
                <th>Курс</th>
                <th>Суроолор</th>
                <th>Өтүү</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((test) => (
                <tr key={test.id}>
                  <td>{test.title}</td>
                  <td>{test.course.title}</td>
                  <td>{test.questionsCount}</td>
                  <td>{test.passingScore}%</td>
                  <td>
                    <div className="admin-lesson-actions">
                      <button
                        type="button"
                        className="qa-admin-btn qa-admin-btn-muted"
                        onClick={() => void openEdit(test.id)}
                        aria-label="Редакциялоо"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="qa-admin-btn qa-admin-btn-danger"
                        onClick={() => void handleDelete(test)}
                        aria-label="Өчүрүү"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="auth-modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="auth-modal ui-card admin-test-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="admin-lesson-modal-head">
              <h3 className="admin-section-title">
                {editingId ? 'Курстук тестти редакциялоо' : 'Жаңы курстук тест'}
              </h3>
              <button type="button" className="auth-modal-close" onClick={closeModal} aria-label="Жабуу">
                <X className="h-5 w-5" />
              </button>
            </header>

            <form className="admin-lesson-form" onSubmit={(e) => void handleSave(e)}>
              {!editingId ? (
                <label className="qa-admin-field">
                  <span className="qa-admin-label">1. Акылуу курс</span>
                  <AdminSelect
                    value={courseSlug}
                    onChange={setCourseSlug}
                    placeholder={availableCourses.length ? 'Курсту тандаңыз...' : 'Бош курс жок'}
                    disabled={!availableCourses.length}
                    options={[
                      { value: '', label: availableCourses.length ? 'Курсту тандаңыз...' : 'Бош курс жок' },
                      ...availableCourses.map((course) => ({
                        value: course.slug,
                        label: course.title,
                      })),
                    ]}
                    aria-label="Акылуу курс"
                  />
                  <span className="admin-test-hint">
                    Бир курс үчүн бир гана финалдык тест. Студент бардык сабактарды бүткөндөн кийин тапшырят.
                  </span>
                </label>
              ) : (
                <p className="admin-test-edit-meta">
                  {paidCourses.find((c) => c.slug === courseSlug)?.title ?? courseSlug}
                </p>
              )}

              <label className="qa-admin-field">
                <span className="qa-admin-label">Тест аталышы</span>
                <input
                  className="qa-admin-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Автоматтык: курс аталышы — курстук тест"
                />
              </label>

              <label className="qa-admin-field">
                <span className="qa-admin-label">Өтүү баллы (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="qa-admin-input"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                />
              </label>

              <div className="admin-test-questions">
                <div className="admin-test-questions-head">
                  <h4 className="admin-lesson-form-title">2. Суроолор (бардык сабактар боюнча)</h4>
                  <div className="admin-test-add-btns">
                    <button
                      type="button"
                      className="qa-admin-btn qa-admin-btn-muted"
                      onClick={() => setQuestions((prev) => [...prev, emptyChoiceQuestion()])}
                    >
                      + А-Б-В-Г
                    </button>
                    <button
                      type="button"
                      className="qa-admin-btn qa-admin-btn-muted"
                      onClick={() => setQuestions((prev) => [...prev, emptyTextQuestion()])}
                    >
                      + Текст
                    </button>
                  </div>
                </div>

                {questions.map((question, qIndex) => (
                  <div key={qIndex} className="ui-card admin-test-question-card">
                    <div className="admin-test-question-head">
                      <span className="admin-test-question-num">{qIndex + 1}-суроо</span>
                      <AdminSelect
                        className="admin-test-type-select"
                        value={question.questionType}
                        onChange={(type) => {
                          updateQuestion(
                            qIndex,
                            type === 'choice' ? emptyChoiceQuestion() : emptyTextQuestion(),
                          );
                        }}
                        options={[
                          { value: 'choice', label: 'А, Б, В, Г' },
                          { value: 'text', label: 'Текст жооп' },
                        ]}
                        aria-label="Суроо түрү"
                      />
                      {questions.length > 1 ? (
                        <button
                          type="button"
                          className="qa-admin-btn qa-admin-btn-danger"
                          onClick={() =>
                            setQuestions((prev) => prev.filter((_, i) => i !== qIndex))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>

                    <label className="qa-admin-field">
                      <span className="qa-admin-label">Суроо</span>
                      <textarea
                        className="qa-admin-textarea"
                        value={question.questionText}
                        onChange={(e) =>
                          updateQuestion(qIndex, { ...question, questionText: e.target.value })
                        }
                        rows={2}
                        required
                      />
                    </label>

                    {question.questionType === 'choice' ? (
                      <div className="admin-test-choice-options">
                        {question.options.map((option, oIndex) => (
                          <label key={option.optionOrder} className="admin-test-choice-row">
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              checked={option.isCorrect}
                              onChange={() =>
                                updateQuestion(qIndex, {
                                  ...question,
                                  options: question.options.map((o) => ({
                                    ...o,
                                    isCorrect: o.optionOrder === option.optionOrder,
                                  })),
                                })
                              }
                            />
                            <span className="admin-test-choice-label">{CHOICE_LABELS[oIndex]})</span>
                            <input
                              className="qa-admin-input"
                              value={option.optionText}
                              onChange={(e) =>
                                updateQuestion(qIndex, {
                                  ...question,
                                  options: question.options.map((o) =>
                                    o.optionOrder === option.optionOrder
                                      ? { ...o, optionText: e.target.value }
                                      : o,
                                  ),
                                })
                              }
                              placeholder={`${CHOICE_LABELS[oIndex]} вариант`}
                              required
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <label className="qa-admin-field">
                        <span className="qa-admin-label">Туура текст жооп</span>
                        <input
                          className="qa-admin-input"
                          value={question.correctTextAnswer}
                          onChange={(e) =>
                            updateQuestion(qIndex, {
                              ...question,
                              correctTextAnswer: e.target.value,
                            })
                          }
                          placeholder="Студент ушундай жазса туура"
                          required
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <div className="qa-admin-form-actions">
                <button type="submit" className="btn-gold qa-admin-btn" disabled={saving}>
                  {saving ? 'Сакталууда...' : 'Сактоо'}
                </button>
                <button type="button" className="qa-admin-btn qa-admin-btn-muted" onClick={closeModal}>
                  Жокко чыгаруу
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
