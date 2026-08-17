import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { PAYMENT_TERMS } from '../data/landing';
import { isCoursePaid, savePaidCourse } from '../lib/courseAccess';

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

type CoursePaymentBlockProps = {
  courseId: string;
  courseTitle: string;
  coursePrice: string;
  lessonCount: number;
  learnPath?: string;
  navigateOnPaid?: boolean;
  onPaid?: () => void;
};

export function CoursePaymentBlock({
  courseId,
  courseTitle,
  coursePrice,
  lessonCount,
  learnPath,
  navigateOnPaid = false,
  onPaid,
}: CoursePaymentBlockProps) {
  const navigate = useNavigate();
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
      onPaid?.();
      if (navigateOnPaid && learnPath) {
        navigate(learnPath);
      }
    }, paymentMethod === 'mbank' ? 1400 : 1800);
  };

  if (paymentStatus === 'paid') {
    return (
      <div className="courses-payment-success">
        <CheckCircle2 className="courses-payment-success-icon" aria-hidden />
        <p className="courses-payment-success-title">Төлөнгөн!</p>
        <p className="courses-payment-success-text">
          {courseTitle} курсу активдештирилди. Видеого өтүүгө даярсыз.
        </p>
        {learnPath ? (
          <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
            Видеого өтүү
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="courses-payment-block">
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
    </div>
  );
}
