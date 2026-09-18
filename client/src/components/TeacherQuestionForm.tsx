import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Send, Sparkles, User, Users } from 'lucide-react';
import { useSiteImages } from '../context/SiteImagesContext';
import { SITE_IMAGE_KEYS } from '../lib/site-images-api';
import {
  fetchNextTeacherQuestionNumber,
  submitTeacherQuestion,
} from '../lib/teacher-questions-api';
import { getErrorMessage, toastError, toastSuccess } from '../lib/toast';

const FOOTER_VALUES = [
  { icon: BookOpen, head: 'Илим —', tail: 'пайда алып келсин' },
  { icon: Users, head: 'Насаат —', tail: 'жүрөктү тазалайт' },
  { icon: Sparkles, head: 'Адеп —', tail: 'адамды көркөм кылат' },
] as const;

export function TeacherQuestionForm() {
  const { image } = useSiteImages();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: nextNumber, isFetching: numberLoading } = useQuery({
    queryKey: ['teacher-questions', 'next-number'],
    queryFn: fetchNextTeacherQuestionNumber,
    staleTime: 30_000,
  });

  const questionLabel = nextNumber != null ? `${nextNumber}-суроо` : 'Сурооңуз';
  const questionPlaceholder =
    nextNumber != null
      ? `${nextNumber}-суроону бул жерге жазыңыз...`
      : 'Сурооңузду бул жерге жазыңыз...';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await submitTeacherQuestion({
        question: question.trim(),
        name: name.trim(),
      });
      toastSuccess(result.message);
      setQuestion('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['teacher-questions', 'next-number'] });
    } catch (err) {
      toastError(getErrorMessage(err, 'Суроо жөнөтүлгөн жок'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="teacher-question-section">
      <div className="wrap teacher-question-wrap">
        <div className="teacher-question-hero">
          <div className="teacher-question-grid">
            <div className="teacher-question-panel">
              <h2 className="teacher-question-title">
                <span className="teacher-question-title-navy">Устазга</span>
                <span className="teacher-question-title-gold">суроо бер!</span>
              </h2>

              <div className="teacher-question-divider" aria-hidden>
                <span />
                <span className="teacher-question-divider-gem">✦</span>
                <span />
              </div>

              <p className="teacher-question-subtitle">
                Суроо бериңиз, устаз Мухаммадалим Халил так жооп берет
              </p>

              <p className="teacher-question-rose-quote">
                «Туура суроо бере билүү — жарым илим.» 🌹
              </p>

              <form
                className={`teacher-question-form${loading ? ' teacher-question-form-busy' : ''}`}
                onSubmit={(e) => void handleSubmit(e)}
              >
                <label className="teacher-question-field">
                  <span className="teacher-question-label-row">
                    <span className="teacher-question-label">{questionLabel}</span>
                    {nextNumber != null ? (
                      <span
                        className={`teacher-question-number-badge${numberLoading ? ' is-loading' : ''}`}
                      >
                        №{nextNumber}
                      </span>
                    ) : null}
                  </span>
                  <span className="teacher-question-input-wrap">
                    <textarea
                      className="teacher-question-textarea"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={4}
                      placeholder={questionPlaceholder}
                      required
                      minLength={10}
                      maxLength={4000}
                    />
                    <Pencil className="teacher-question-field-icon" aria-hidden />
                  </span>
                </label>

                <label className="teacher-question-field">
                  <span className="teacher-question-label">Аты-жөнү</span>
                  <span className="teacher-question-input-wrap">
                    <input
                      type="text"
                      className="teacher-question-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Атыңызды жана фамилияңызды жазыңыз..."
                      required
                      minLength={2}
                      maxLength={200}
                      autoComplete="name"
                    />
                    <User className="teacher-question-field-icon" aria-hidden />
                  </span>
                </label>

                <div className="teacher-question-actions">
                  <button type="submit" className="teacher-question-submit" disabled={loading}>
                    <Send className="h-4 w-4" aria-hidden />
                    {loading ? 'Жөнөтүлүүдө...' : 'Жөнөтүү'}
                  </button>
                </div>
              </form>
            </div>

            <div className="teacher-question-visual-col">
              <div className="teacher-question-visual">
                <img
                  src={image(SITE_IMAGE_KEYS.teacherQuestionScene)}
                  alt="Устаз Мухаммадалим Халил студенттер менен"
                  className="teacher-question-visual-img"
                  loading="lazy"
                  decoding="async"
                />
                <blockquote className="teacher-question-visual-quote">
                  <span className="teacher-question-quote-mark" aria-hidden>
                    “
                  </span>
                  <p className="teacher-question-visual-quote-text">
                    <span className="teacher-question-visual-quote-gold">Илим үйрөнүү —</span>
                    <span className="teacher-question-visual-quote-light">
                      ар бир мусулмандын милдети.
                    </span>
                  </p>
                </blockquote>
              </div>

              <div className="teacher-question-footer">
                <div className="teacher-question-wave-wrap" aria-hidden>
                  <svg
                    className="teacher-question-wave"
                    viewBox="0 0 1440 88"
                    preserveAspectRatio="none"
                  >
                    <path
                      className="teacher-question-wave-fill"
                      d="M0,78 C140,78 220,16 420,24 C620,32 700,68 880,46 C1060,24 1180,8 1440,20 L1440,88 L0,88 Z"
                    />
                    <path
                      className="teacher-question-wave-edge"
                      d="M0,78 C140,78 220,16 420,24 C620,32 700,68 880,46 C1060,24 1180,8 1440,20"
                    />
                  </svg>
                </div>
                <ul className="teacher-question-values">
                  {FOOTER_VALUES.map(({ icon: Icon, head, tail }) => (
                    <li key={head} className="teacher-question-value">
                      <span className="teacher-question-value-icon">
                        <Icon className="teacher-question-value-icon-svg" aria-hidden />
                      </span>
                      <span className="teacher-question-value-text">
                        <span className="teacher-question-value-head">{head}</span>
                        <span className="teacher-question-value-tail">{tail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
