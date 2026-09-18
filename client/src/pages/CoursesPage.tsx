import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { PAYMENT_TERMS, SITE } from '../data/landing';
import { useAuth } from '../context/AuthContext';
import { useCourseEnrollment } from '../hooks/useMyEnrollments';
import { UserAuthModal } from '../components/UserAuthModal';

const PAYMENT_PENDING_KEY = 'mualim-payment-pending';

function savePaymentPending(courseRef: string, pending: boolean) {
  const key = `${PAYMENT_PENDING_KEY}:${courseRef}`;
  if (pending) sessionStorage.setItem(key, '1');
  else sessionStorage.removeItem(key);
}

function buildWhatsappPayUrl(input: {
  courseTitle: string;
  coursePrice: string;
  userName: string;
  userEmail: string;
  userPhone: string;
}) {
  const text = [
    'Ассаламу алейкум!',
    `${input.courseTitle} курсун төлөөгө кайрылуудам.`,
    `Баасы: ${input.coursePrice}`,
    `Аты-жөнүм: ${input.userName}`,
    `Email: ${input.userEmail}`,
    input.userPhone ? `WhatsApp: ${input.userPhone}` : null,
    'Төлөм реквизиттерин жибериңиз. Төлөгөндөн кийин чекти/scrinshotту тиркеп жиберем.',
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/${SITE.whatsappDigits}?text=${encodeURIComponent(text)}`;
}

type CoursePaymentBlockProps = {
  courseRef: string;
  courseRecordId: string;
  courseTitle: string;
  coursePrice: string;
  lessonCount: number;
  learnPath: string;
  onEnrolled?: () => void;
};

export function CoursePaymentBlock({
  courseRef,
  courseRecordId,
  courseTitle,
  coursePrice,
  lessonCount,
  learnPath,
  onEnrolled,
}: CoursePaymentBlockProps) {
  const { user, isUser } = useAuth();
  const { enrolled, isLoading, isFetching, refetch, needsLogin } = useCourseEnrollment({
    id: courseRef,
    slug: courseRef,
    recordId: courseRecordId,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setTermsAccepted(false);
    setError('');
    setPending(false);
  }, [courseRef]);

  useEffect(() => {
    if (enrolled) {
      savePaymentPending(courseRef, false);
      setPending(false);
      onEnrolled?.();
    }
  }, [enrolled, courseRef, onEnrolled]);

  const handlePay = () => {
    if (!user || paying) return;
    if (!termsAccepted) {
      setError('Төлөм шарттары менен макул болуңуз');
      return;
    }

    setError('');
    setPaying(true);

    const url = buildWhatsappPayUrl({
      courseTitle,
      coursePrice,
      userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      userEmail: user.email,
      userPhone: user.phone ?? '',
    });

    window.open(url, '_blank', 'noopener,noreferrer');
    savePaymentPending(courseRef, true);
    setPending(true);
    setPaying(false);
  };

  if (isLoading) {
    return (
      <div className="courses-payment-block">
        <p className="courses-payment-hint m-0">Жүктөлүүдө...</p>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <>
        <div className="courses-payment-block">
          <div className="courses-payment-top">
            <MessageCircle className="h-4 w-4" aria-hidden />
            <span className="courses-payment-title">WhatsApp менен төлөм</span>
          </div>
          <p className="courses-payment-price">{coursePrice}</p>
          <p className="courses-payment-hint">
            Төлөм үчүн аккаунтуңузга кирүү же катталуу керек. Менеджер чекти текшерип, админ панель аркылуу
            сабактарга доступ берет.
          </p>
          <button type="button" className="btn-primary courses-payment-btn w-full" onClick={() => setAuthOpen(true)}>
            Кирүү / катталуу
          </button>
        </div>
        <UserAuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialTab="login" />
      </>
    );
  }

  if (enrolled) {
    return (
      <div className="courses-payment-success">
        <CheckCircle2 className="courses-payment-success-icon" aria-hidden />
        <p className="courses-payment-success-title">Доступ ачылды!</p>
        <p className="courses-payment-success-text">
          {courseTitle} — 1-сабак ачылды. Кийинки сабактар мурункусу бүткөндөн кийин ачылат.
        </p>
        <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
          Сабактарга өтүү
        </Link>
      </div>
    );
  }

  const reopenUrl = user
    ? buildWhatsappPayUrl({
        courseTitle,
        coursePrice,
        userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        userEmail: user.email,
        userPhone: user.phone ?? '',
      })
    : '';

  if (pending) {
    return (
      <div className="courses-payment-success courses-enroll-pending">
        <MessageCircle className="courses-payment-success-icon" aria-hidden />
        <p className="courses-payment-success-title">Төлөм күтүлүүдө</p>
        <p className="courses-payment-success-text">
          WhatsApp аркылуу төлөмдү жүргүзүп, чекти жибериңиз. Менеджер чекти текшергенден кийин гана сабактар
          ачылат.
        </p>
        <ol className="courses-enroll-steps">
          <li>WhatsAppтан төлөм реквизиттерин алыңыз.</li>
          <li>Төлөгөндөн кийин чекти (скриншот) WhatsAppка жибериңиз.</li>
          <li>Менеджер админ панель аркылуу доступ берет.</li>
        </ol>
        <a
          href={reopenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold courses-payment-btn w-full text-center no-underline"
        >
          WhatsAppты кайра ачуу
        </a>
        <button
          type="button"
          className="btn-primary courses-payment-btn w-full"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Текшерилүүдө...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Доступ берилдиби? Текшерүү
            </>
          )}
        </button>
        <p className="courses-payment-success-note">
          Эгер менеджер чекти ырастаса, «Текшерүү» баскычын басыңыз.
        </p>
      </div>
    );
  }

  return (
    <div className="courses-payment-block">
      <div className="courses-payment-top">
        <MessageCircle className="h-4 w-4" aria-hidden />
        <span className="courses-payment-title">WhatsApp менен төлөм</span>
      </div>
      <p className="courses-payment-price">{coursePrice}</p>
      <p className="courses-payment-hint">
        {lessonCount} сабак · «Оплатить» баскычын басып WhatsAppка өтүңүз, төлөп чекти жибериңиз
      </p>

      <div className="courses-payment-terms">
        <p className="courses-payment-terms-title">Катталуу жана төлөм шарттары</p>
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
          disabled={paying}
        />
        <span>Шарттар менен макулмун</span>
      </label>
      {error ? <p className="courses-enroll-whatsapp-error">{error}</p> : null}

      <button
        type="button"
        className="btn-gold courses-payment-btn w-full"
        onClick={handlePay}
        disabled={paying || !termsAccepted || !isUser}
      >
        {paying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            WhatsApp ачылууда...
          </>
        ) : (
          'Оплатить'
        )}
      </button>
    </div>
  );
}
