import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ClipboardList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminCourses } from '../../lib/admin-courses-api';
import {
  CHOICE_LABELS,
  MAX_CHOICE_OPTIONS,
  MIN_CHOICE_OPTIONS,
  createAdminTest,
  deleteAdminTest,
  emptyChoiceQuestion,
  emptyTextQuestion,
  fetchAdminTest,
  fetchAdminTests,
  textTrueFalseAnswer,
  trueFalseQuestion,
  updateAdminTest,
  type AdminTestDetail,
  type AdminTestListItem,
  type CreateTestQuestionInput,
  type UpdateTestInput,
} from '../../lib/admin-tests-api';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { getErrorMessage, toastError, toastSuccess } from '../../lib/toast';

type PaidCourseOption = { slug: string; title: string; isPublished: boolean };

/** What the edit form loaded, so a save sends only the fields that really changed. */
type EditBaseline = { title: string; passingScore: number; isActive: boolean; questionsKey: string };

/** Normalised form questions as a string: equal keys mean the questions were not edited. */
function questionsKey(questions: CreateTestQuestionInput[]) {
  return JSON.stringify(toCreateQuestions(questions));
}

const DELETE_CONFIRM = (title: string) =>
  `"${title}" тестин биротоло өчүрөсүзбү?\n\n` +
  'Тест жана анын суроолору өчүрүлөт. Ошону менен бирге студенттердин бул тест боюнча ' +
  'аракеттеринин тарыхы (упайлар, 3 жолку бөгөт) жана «тестти тапшырды» деген статусу жоголушу мүмкүн. ' +
  'Аларды калыбына келтирүүгө болбойт, ал эми сертификаты жок студенттер тестти кайра тапшырышы керек болушу мүмкүн. ' +
  'Мурда берилген сертификаттар бул аракет менен өчүрүлбөйт.\n\n' +
  'Тестти студенттерден жашыруу гана керек болсо, бул терезеде баш тартып, ' +
  'тестти «Өчүрүү» баскычы же түзөтүү формасындагы «Активдүү» белгиси менен өчүрүңүз.';

const DEACTIVATE_CONFIRM = (title: string) =>
  `"${title}" тестин өчүрөсүзбү?\n\n` +
  'Студенттер бул тестти көрбөй жана тапшыра албай калат. Тест, суроолор жана студенттердин аракеттери ' +
  'өчүрүлбөйт — тестти каалаган убакта кайра активдештирсе болот.';

const EMPTY_TEST_ACTIVATE_CONFIRM = (title: string) =>
  `"${title}" тестинин суроолорунун саны тизмеде 0 деп көрсөтүлгөн.\n\n` +
  'Бул сан тест менен сакталган сан гана, активдүү суроолордун чыныгы санын көрсөтпөшү мүмкүн. ' +
  'Суроосу жок тестти студенттер тапшыра албай калышы мүмкүн.\n\n' +
  'Баары бир активдештиресизби?';

/** A passing score from the form field, or null when it is empty or not 0–100. */
function parsePassingScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function toCreateQuestions(questions: CreateTestQuestionInput[]): CreateTestQuestionInput[] {
  return questions.map((q) => {
    if (q.questionType === 'choice') {
      return {
        questionType: 'choice' as const,
        questionText: q.questionText.trim(),
        options: q.options.map((o, i) => ({
          optionText: o.optionText.trim(),
          isCorrect: o.isCorrect,
          optionOrder: i + 1,
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

/** "А, Б" for two options, "А, Б, В, Г" for four. */
function choiceLabels(count: number) {
  return CHOICE_LABELS.slice(0, count).join(', ');
}

/** Switches the question type but keeps the question text (and a text answer of
 * "Туура" / "Туура эмес" becomes the matching А/Б choice). */
function changeQuestionType(
  question: CreateTestQuestionInput,
  type: CreateTestQuestionInput['questionType'],
): CreateTestQuestionInput {
  if (type === question.questionType) return question;
  const { questionText } = question;
  if (type === 'choice') {
    const answer = textTrueFalseAnswer(question);
    return answer === null
      ? ({ ...emptyChoiceQuestion(), questionText } as CreateTestQuestionInput)
      : trueFalseQuestion(questionText, answer);
  }
  const correctOption =
    question.questionType === 'choice' ? question.options.find((o) => o.isCorrect)?.optionText : '';
  return { questionType: 'text', questionText, correctTextAnswer: correctOption ?? '' };
}

function detailToFormQuestions(test: AdminTestDetail): CreateTestQuestionInput[] {
  return test.questions.map((q) => {
    if (q.questionType === 'choice') {
      return {
        questionType: 'choice',
        questionText: q.questionText,
        options: [...q.options]
          .sort((a, b) => a.optionOrder - b.optionOrder)
          .map((o, i) => ({
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            optionOrder: i + 1,
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
  const [passingScore, setPassingScore] = useState('90');
  const [questions, setQuestions] = useState<CreateTestQuestionInput[]>([emptyChoiceQuestion()]);
  const [isActive, setIsActive] = useState(true);
  const [baseline, setBaseline] = useState<EditBaseline | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /** Courses with a course-level final test (active or not). A lesson-bound test does not count:
   * students never get it, and the server still allows a course-level test next to it. */
  const coursesWithTest = useMemo(
    () => new Set(items.filter((item) => !item.lesson).map((item) => item.course.slug)),
    [items],
  );

  const availableCourses = useMemo(
    () =>
      editingId
        ? paidCourses
        : paidCourses.filter((course) => !coursesWithTest.has(course.slug)),
    [paidCourses, editingId, coursesWithTest],
  );

  /** Paid courses with no final test at all; a course whose test is only inactive is not listed. */
  const coursesWithoutTest = useMemo(
    () => paidCourses.filter((course) => !coursesWithTest.has(course.slug)),
    [paidCourses, coursesWithTest],
  );

  const showFormError = (message: string) => {
    toastError(message);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [testsData, firstPage] = await Promise.all([
        fetchAdminTests(token),
        fetchAdminCourses(token, { type: 'paid', page: 1, limit: 100 }),
      ]);
      const restPages = await Promise.all(
        Array.from({ length: Math.max(0, (firstPage.totalPages ?? 1) - 1) }, (_, i) =>
          fetchAdminCourses(token, { type: 'paid', page: i + 2, limit: 100 }),
        ),
      );
      const seen = new Set<string>();
      // Pages are offset-based, so a course can repeat if the list changes while loading; keep the first.
      const courses = [firstPage, ...restPages]
        .flatMap((page) => page.items)
        .filter((course) => (seen.has(course.slug) ? false : (seen.add(course.slug), true)));
      setItems(testsData.items);
      setPaidCourses(
        courses.map((c) => ({ slug: c.slug, title: c.title, isPublished: c.isPublished })),
      );
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
    setPassingScore('90');
    setQuestions([emptyChoiceQuestion()]);
    setIsActive(true);
    setBaseline(null);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openCreateFor = (slug: string) => {
    resetForm();
    setCourseSlug(slug);
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
      const formQuestions = detailToFormQuestions(test);
      setQuestions(formQuestions);
      setIsActive(test.isActive);
      setBaseline({
        title: test.title,
        passingScore: Number(test.passingScore),
        isActive: test.isActive,
        questionsKey: questionsKey(formQuestions),
      });
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
    // When editing, untouched questions are not re-sent (the server would recreate them with new ids).
    const questionsChanged = !editingId || !baseline || questionsKey(questions) !== baseline.questionsKey;

    if (questionsChanged && prepared.some((q) => !q.questionText)) {
      showFormError('Бардык суроолорду толтуруңуз');
      return;
    }

    for (const q of questionsChanged ? prepared : []) {
      if (q.questionType === 'choice') {
        if (q.options.some((o) => !o.optionText)) {
          showFormError('Бардык варианттарды толтуруңуз');
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

    const trimmedTitle = title.trim() || undefined;
    const parsedScore = parsePassingScore(passingScore);
    // Empty or invalid input: a new test gets the usual 90, an edited test keeps its saved score.
    const score = parsedScore ?? 90;

    let update: UpdateTestInput | null = null;
    if (editingId && baseline) {
      update = {};
      if (trimmedTitle !== undefined && trimmedTitle !== baseline.title) update.title = trimmedTitle;
      if (parsedScore !== null && parsedScore !== baseline.passingScore) update.passingScore = parsedScore;
      if (isActive !== baseline.isActive) update.isActive = isActive;
      if (questionsChanged) update.questions = prepared;
      if (Object.keys(update).length === 0) {
        closeModal();
        return;
      }
      const listed = items.find((item) => item.id === editingId);
      if (update.isActive === true && listed?.questionsCount === 0) {
        if (!window.confirm(EMPTY_TEST_ACTIVATE_CONFIRM(listed.title))) return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateAdminTest(
          token,
          editingId,
          update ?? { title: trimmedTitle, passingScore: score, questions: prepared },
        );
      } else {
        await createAdminTest(token, {
          title: trimmedTitle,
          passingScore: score,
          questions: prepared,
          courseRef: courseSlug,
        });
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
    const ok = window.confirm(DELETE_CONFIRM(test.title));
    if (!ok) return;
    try {
      await deleteAdminTest(token, test.id);
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Өчүрүү ийгиликсиз'));
    }
  };

  /** Sends only the status, so the questions (and their ids) stay as they are. */
  const handleToggleActive = async (test: AdminTestListItem) => {
    if (!token || togglingId) return;
    if (test.isActive && !window.confirm(DEACTIVATE_CONFIRM(test.title))) return;
    if (!test.isActive && test.questionsCount === 0 && !window.confirm(EMPTY_TEST_ACTIVATE_CONFIRM(test.title))) {
      return;
    }
    setTogglingId(test.id);
    try {
      await updateAdminTest(token, test.id, { isActive: !test.isActive });
      toastSuccess(test.isActive ? 'Тест өчүрүлдү' : 'Тест активдештирилди');
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Абалы өзгөргөн жок'));
    } finally {
      setTogglingId(null);
    }
  };

  const updateQuestion = (index: number, next: CreateTestQuestionInput) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? next : q)));
  };

  const addOption = (index: number, question: CreateTestQuestionInput) => {
    if (question.questionType !== 'choice' || question.options.length >= MAX_CHOICE_OPTIONS) return;
    updateQuestion(index, {
      ...question,
      options: [
        ...question.options,
        { optionText: '', isCorrect: false, optionOrder: question.options.length + 1 },
      ],
    });
  };

  const removeOption = (index: number, question: CreateTestQuestionInput, optionIndex: number) => {
    if (question.questionType !== 'choice' || question.options.length <= MIN_CHOICE_OPTIONS) return;
    const options = question.options
      .filter((_, i) => i !== optionIndex)
      .map((o, i) => ({ ...o, optionOrder: i + 1 }));
    if (!options.some((o) => o.isCorrect)) options[0] = { ...options[0], isCorrect: true };
    updateQuestion(index, { ...question, options });
  };

  const trueFalseTextCount = questions.filter((q) => textTrueFalseAnswer(q) !== null).length;

  const convertTrueFalseTextQuestions = () => {
    setQuestions((prev) =>
      prev.map((q) => {
        const answer = textTrueFalseAnswer(q);
        return answer === null ? q : trueFalseQuestion(q.questionText, answer);
      }),
    );
    toastSuccess(`${trueFalseTextCount} суроо А) Туура / Б) Туура эмес болду. Сактоону басыңыз.`);
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
          <table className="admin-users-table admin-users-table-cards">
            <thead>
              <tr>
                <th>Тест</th>
                <th>Курс</th>
                <th>Суроолор</th>
                <th>Өтүү</th>
                <th>Абалы</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((test) => (
                <tr key={test.id}>
                  <td className="admin-users-cell-name">
                    {test.title}
                    {test.lesson ? (
                      <span
                        className="admin-test-hint"
                        title="Студенттер курстук финалдык тест катары бул тестти алышпайт"
                      >
                        {' '}
                        · Сабакка байланган ({test.lesson.lessonOrder}-сабак: {test.lesson.title})
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Курс">{test.course.title}</td>
                  <td data-label="Суроолор">{test.questionsCount}</td>
                  <td data-label="Өтүү">{test.passingScore}%</td>
                  <td data-label="Абалы">
                    <span
                      className={`admin-users-status ${
                        test.isActive ? 'admin-users-status-active' : 'admin-users-status-blocked'
                      }`}
                    >
                      {test.isActive ? 'Активдүү' : 'Өчүк'}
                    </span>
                  </td>
                  <td className="admin-users-cell-actions">
                    <div className="admin-lesson-actions">
                      <button
                        type="button"
                        className="qa-admin-btn qa-admin-btn-muted"
                        onClick={() => void handleToggleActive(test)}
                        disabled={togglingId !== null}
                      >
                        {test.isActive ? 'Өчүрүү' : 'Активдештирүү'}
                      </button>
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
                        aria-label="Биротоло өчүрүү"
                        title="Биротоло өчүрүү"
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

      {!loading && !error && coursesWithoutTest.length > 0 ? (
        <div className="admin-users-table-wrap ui-card">
          <h3 className="admin-section-title">Тести жок акылуу курстар · {coursesWithoutTest.length}</h3>
          <table className="admin-users-table admin-users-table-cards">
            <thead>
              <tr>
                <th>Курс</th>
                <th>Абалы</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coursesWithoutTest.map((course) => (
                <tr key={course.slug}>
                  <td className="admin-users-cell-name">{course.title}</td>
                  <td data-label="Абалы">{course.isPublished ? 'Жарыяланган' : 'Жарыяланбаган'}</td>
                  <td className="admin-users-cell-actions">
                    <div className="admin-lesson-actions">
                      <button
                        type="button"
                        className="btn-gold qa-admin-btn"
                        onClick={() => openCreateFor(course.slug)}
                      >
                        <Plus className="h-4 w-4" />
                        Тест түзүү
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

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

              {editingId ? (
                <label className="qa-admin-field admin-course-checkbox">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span>Активдүү (студенттерге көрүнөт)</span>
                </label>
              ) : null}

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
                      onClick={() => setQuestions((prev) => [...prev, emptyChoiceQuestion(2)])}
                    >
                      + А-Б
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
                {trueFalseTextCount > 0 ? (
                  <button
                    type="button"
                    className="qa-admin-btn qa-admin-btn-muted"
                    onClick={convertTrueFalseTextQuestions}
                  >
                    Жообу «Туура / Туура эмес» болгон {trueFalseTextCount} текст суроону А/Б вариантка айландыруу
                  </button>
                ) : null}

                {questions.map((question, qIndex) => (
                  <div key={qIndex} className="ui-card admin-test-question-card">
                    <div className="admin-test-question-head">
                      <span className="admin-test-question-num">{qIndex + 1}-суроо</span>
                      <AdminSelect
                        className="admin-test-type-select"
                        value={question.questionType}
                        onChange={(type) =>
                          updateQuestion(
                            qIndex,
                            changeQuestionType(question, type as CreateTestQuestionInput['questionType']),
                          )
                        }
                        options={[
                          {
                            value: 'choice',
                            label: choiceLabels(
                              question.questionType === 'choice' ? question.options.length : 4,
                            ),
                          },
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
                            {question.options.length > MIN_CHOICE_OPTIONS ? (
                              <button
                                type="button"
                                className="qa-admin-btn qa-admin-btn-danger"
                                onClick={() => removeOption(qIndex, question, oIndex)}
                                aria-label={`${CHOICE_LABELS[oIndex]} вариантын өчүрүү`}
                                title="Вариантты өчүрүү"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </label>
                        ))}
                        {question.options.length < MAX_CHOICE_OPTIONS ? (
                          <button
                            type="button"
                            className="qa-admin-btn qa-admin-btn-muted"
                            onClick={() => addOption(qIndex, question)}
                          >
                            + {CHOICE_LABELS[question.options.length]} вариант
                          </button>
                        ) : null}
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
