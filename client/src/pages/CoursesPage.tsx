import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, CreditCard, Loader2, Star } from 'lucide-react';
import { PAID_COURSES, PAYMENT_TERMS } from '../data/landing';
import { isCoursePaid, loadPaidCourses, savePaidCourse } from '../lib/courseAccess';

const PAYMENT_METHODS = [
  { id: 'mbank', label: 'MBank' },
  { id: 'card', label: 'Visa / MC' },
  { id: 'elcart', label: 'Элкарт' },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id'];
type PaymentStatus = 'idle' | 'processing' | 'paid';

function methodLabel(id: PaymentMethodId) {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}

function StarRating({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <span
      className={`course-stars${compact ? ' course-stars-compact' : ''}`}
      aria-label={`${value} из 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`course-star ${i < Math.round(value) ? 'course-star-filled' : ''}`}
          fill={i < Math.round(value) ? 'currentColor' : 'none'}
          strokeWidth={1.75}
        />
      ))}
      <span className="course-rating-num">{value}</span>
    </span>
  );
}

type CoursePaymentBlockProps = {
  courseId: string;
  courseTitle: string;
  coursePrice: string;
  lessonCount: number;
  onPaid: () => void;
};

export function CoursePaymentBlock({
  courseId,
  courseTitle,
  coursePrice,
  lessonCount,
  onPaid,
}: CoursePaymentBlockProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('mbank');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() =>
    isCoursePaid(courseId) ? 'paid' : 'idle',
  );

  useEffect(() => {
    setPaymentStatus(isCoursePaid(courseId) ? 'paid' : 'idle');
    setTermsAccepted(false);
  }, [courseId]);

  const handlePay = () => {
    if (!termsAccepted || paymentStatus === 'processing' || paymentStatus === 'paid') return;
    setPaymentStatus('processing');
    window.setTimeout(() => {
      savePaidCourse(courseId);
      setPaymentStatus('paid');
      onPaid();
    }, paymentMethod === 'mbank' ? 1400 : 1800);
  };

  if (paymentStatus === 'paid') {
    return (
      <div className="courses-payment-success">
        <CheckCircle2 className="courses-payment-success-icon" aria-hidden />
        <p className="courses-payment-success-title">Төлөнгөн!</p>
        <p className="courses-payment-success-text">
          {courseTitle} курсу активдештирилди. 1-видеодон баштаңыз.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="courses-payment-top">
        <CreditCard className="h-4 w-4" aria-hidden />
        <span className="courses-payment-title">Төлөм</span>
      </div>
      <p className="courses-payment-price">{coursePrice}</p>
      <p className="courses-payment-hint">{lessonCount} видео-сабакка кирүү</p>

      <div className="courses-payment-methods">
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method.id}
            className={`courses-payment-method${
              paymentMethod === method.id ? ' courses-payment-method-active' : ''
            }`}
          >
            <input
              type="radio"
              name={`payment-${courseId}`}
              value={method.id}
              checked={paymentMethod === method.id}
              onChange={() => setPaymentMethod(method.id)}
              className="courses-payment-radio"
              disabled={paymentStatus === 'processing'}
            />
            <span>{method.label}</span>
          </label>
        ))}
      </div>

      <div className="courses-payment-terms">
        <p className="courses-payment-terms-title">Төлөм шарттары</p>
        <ul className="courses-payment-terms-list">
          {PAYMENT_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>

      <label className="courses-payment-terms-check">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="courses-payment-terms-checkbox"
          disabled={paymentStatus === 'processing'}
        />
        <span>Төлөм шарттары менен макулмун</span>
      </label>

      <button
        type="button"
        className="btn-primary courses-payment-btn w-full"
        onClick={handlePay}
        disabled={!termsAccepted || paymentStatus === 'processing'}
      >
        {paymentStatus === 'processing' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {paymentMethod === 'mbank' ? 'MBank текшерилүүдө...' : 'Төлөм жүргүзүлүүдө...'}
          </>
        ) : (
          `Төлөө — ${methodLabel(paymentMethod)}`
        )}
      </button>
    </>
  );
}

export function CoursesPage() {
  const paidCourseIds = loadPaidCourses();

  return (
    <section className="courses-page">
      <div className="wrap courses-page-inner">
        <div className="courses-page-head">
          <p className="courses-page-label">Mualim Academy</p>
          <h1 className="courses-page-title">Акылуу курстар</h1>
          <p className="courses-page-subtitle">Курстан тандаңыз — бардык видеолор тизмede көрүнөт.</p>
        </div>

        <aside className="courses-sidebar ui-card courses-page-list-only">
          <h2 className="courses-sidebar-title">
            <BookOpen className="h-5 w-5" aria-hidden />
            Бардык курстар
          </h2>
          <ul className="courses-sidebar-list">
            {PAID_COURSES.map((course) => (
              <li key={course.id}>
                <NavLink
                  to={`/courses/${course.id}/learn`}
                  className={({ isActive }) =>
                    `courses-sidebar-item${isActive ? ' courses-sidebar-item-active' : ''}${
                      paidCourseIds.includes(course.id) ? ' courses-sidebar-item-paid' : ''
                    }`
                  }
                >
                  <span className="courses-sidebar-text">
                    <span className="courses-sidebar-name">{course.title}</span>
                    <span className="courses-sidebar-meta">
                      <StarRating value={course.rating} compact />
                      <span className="courses-sidebar-lessons">{course.lessons} сабак</span>
                    </span>
                  </span>
                  <span className="courses-sidebar-price">{course.price}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </aside>

        <Link to="/" className="courses-page-back">
          <ArrowLeft className="h-4 w-4" />
          Башкы бетке кайтуу
        </Link>
      </div>
    </section>
  );
}
