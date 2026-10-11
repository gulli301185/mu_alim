import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CheckCircle2, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { PAYMENT_TERMS, SITE } from '../data/landing';
import { useAuth } from '../context/AuthContext';
import { useCourseEnrollment } from '../hooks/useMyEnrollments';
import { UserAuthModal } from '../components/UserAuthModal';
import { localizedList } from '../i18n/localizedList';

const PAYMENT_PENDING_KEY = 'mualim-payment-pending';

function savePaymentPending(courseRef: string, pending: boolean) {
  const key = `${PAYMENT_PENDING_KEY}:${courseRef}`;
  if (pending) sessionStorage.setItem(key, '1');
  else sessionStorage.removeItem(key);
}

function buildWhatsappPayUrl(t: TFunction, input: {
  courseTitle: string;
  coursePrice: string;
  userName: string;
  userEmail: string;
  userPhone: string;
}) {
  const text = [
    t('payment.msgGreeting'),
    t('payment.msgIntro', { title: input.courseTitle }),
    t('payment.msgPrice', { price: input.coursePrice }),
    t('payment.msgName', { name: input.userName }),
    `Email: ${input.userEmail}`,
    input.userPhone ? `WhatsApp: ${input.userPhone}` : null,
    t('payment.msgOutro'),
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
  const { t, i18n } = useTranslation();
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
      setError(t('payment.termsRequired'));
      return;
    }

    setError('');
    setPaying(true);

    const url = buildWhatsappPayUrl(t, {
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
        <p className="courses-payment-hint m-0">{t('common.loading')}</p>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <>
        <div className="courses-payment-block">
          <div className="courses-payment-top">
            <MessageCircle className="h-4 w-4" aria-hidden />
            <span className="courses-payment-title">{t('payment.whatsappTitle')}</span>
          </div>
          <p className="courses-payment-price">{coursePrice}</p>
          <p className="courses-payment-hint">{t('payment.needLogin')}</p>
          <button type="button" className="btn-primary courses-payment-btn w-full" onClick={() => setAuthOpen(true)}>
            {t('payment.loginOrRegister')}
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
        <p className="courses-payment-success-title">{t('payment.accessOpened')}</p>
        <p className="courses-payment-success-text">
          {t('payment.accessOpenedText', { title: courseTitle })}
        </p>
        <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
          {t('payment.goToLessons')}
        </Link>
      </div>
    );
  }

  const reopenUrl = user
    ? buildWhatsappPayUrl(t, {
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
        <p className="courses-payment-success-title">{t('payment.pendingTitle')}</p>
        <p className="courses-payment-success-text">
          {t('payment.pendingText')}
        </p>
        <ol className="courses-enroll-steps">
          <li>{t('payment.step1')}</li>
          <li>{t('payment.step2')}</li>
          <li>{t('payment.step3')}</li>
        </ol>
        <a
          href={reopenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold courses-payment-btn w-full text-center no-underline"
        >
          {t('payment.reopenWhatsapp')}
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
              {t('payment.checking')}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t('payment.checkAccess')}
            </>
          )}
        </button>
        <p className="courses-payment-success-note">
          {t('payment.checkNote')}
        </p>
      </div>
    );
  }

  return (
    <div className="courses-payment-block">
      <div className="courses-payment-top">
        <MessageCircle className="h-4 w-4" aria-hidden />
        <span className="courses-payment-title">{t('payment.whatsappTitle')}</span>
      </div>
      <p className="courses-payment-price">{coursePrice}</p>
      <p className="courses-payment-hint">
        {t('payment.hint', { count: lessonCount })}
      </p>

      <div className="courses-payment-terms">
        <p className="courses-payment-terms-title">{t('payment.termsTitle')}</p>
        <ul className="courses-payment-terms-list">
          {localizedList(i18n, 'payment.terms', PAYMENT_TERMS, { phone: SITE.phone }).map((term) => (
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
        <span>{t('payment.termsAgree')}</span>
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
            {t('payment.opening')}
          </>
        ) : (
          t('payment.pay')
        )}
      </button>
    </div>
  );
}
