import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Loader2 } from 'lucide-react';
import { PAYMENT_TERMS, SITE } from '../data/landing';
import { isCoursePaid, savePaidCourse } from '../lib/courseAccess';

type EnrollStatus = 'idle' | 'sending' | 'sent' | 'paid';

function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('996')) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `996${digits.slice(1)}`;
  if (digits.length === 9) return `996${digits}`;
  return digits;
}

function buildWhatsappEnrollUrl(input: {
  courseTitle: string;
  coursePrice: string;
  userWhatsapp: string;
}) {
  const text = [
    'Ассаламу алейкум!',
    `${input.courseTitle} курсуна катталайын.`,
    `Баасы: ${input.coursePrice}`,
    `Менин WhatsApp номерим: ${input.userWhatsapp}`,
    'Төлөм реквизиттерин жана кирүүнү күтөм.',
  ].join('\n');

  return `https://wa.me/${SITE.whatsappDigits}?text=${encodeURIComponent(text)}`;
}

type CoursePaymentBlockProps = {
  courseId: string;
  courseTitle: string;
  coursePrice: string;
  lessonCount: number;
  telegramUrl?: string;
  learnPath?: string;
  navigateOnPaid?: boolean;
  onPaid?: () => void;
};

export function CoursePaymentBlock({
  courseId,
  courseTitle,
  coursePrice,
  lessonCount,
  telegramUrl = SITE.paidTelegramInvite,
  learnPath,
  navigateOnPaid = false,
  onPaid,
}: CoursePaymentBlockProps) {
  const navigate = useNavigate();
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappError, setWhatsappError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [status, setStatus] = useState<EnrollStatus>(() =>
    isCoursePaid(courseId) ? 'paid' : 'idle',
  );

  useEffect(() => {
    setStatus(isCoursePaid(courseId) ? 'paid' : 'idle');
    setTermsAccepted(false);
    setWhatsappError('');
  }, [courseId]);

  const handleEnrollWhatsapp = () => {
    if (status === 'sending' || status === 'paid') return;

    const normalized = normalizeWhatsapp(whatsapp);
    if (!normalized) {
      setWhatsappError('WhatsApp номерин туура жазыңыз (+996 ...)');
      return;
    }
    if (!termsAccepted) {
      setWhatsappError('Төлөм шарттары менен макул болуңуз');
      return;
    }

    setWhatsappError('');
    setStatus('sending');

    const url = buildWhatsappEnrollUrl({
      courseTitle,
      coursePrice,
      userWhatsapp: `+${normalized}`,
    });

    window.open(url, '_blank', 'noopener,noreferrer');

    window.setTimeout(() => {
      setStatus('sent');
    }, 600);
  };

  const handleUnlockAfterConfirm = () => {
    savePaidCourse(courseId);
    setStatus('paid');
    onPaid?.();
    if (!telegramUrl && navigateOnPaid && learnPath) {
      navigate(learnPath);
    }
  };

  if (status === 'paid') {
    return (
      <div className="courses-payment-success">
        <CheckCircle2 className="courses-payment-success-icon" aria-hidden />
        <p className="courses-payment-success-title">Доступ ачылды!</p>
        <p className="courses-payment-success-text">
          {courseTitle} — сабактар Telegram группасында.
        </p>
        {telegramUrl ? (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary courses-payment-btn w-full"
          >
            Telegramга өтүү
          </a>
        ) : learnPath ? (
          <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
            Видеого өтүү
          </Link>
        ) : null}
      </div>
    );
  }

  if (status === 'sent') {
    const normalized = normalizeWhatsapp(whatsapp);
    const reopenUrl = buildWhatsappEnrollUrl({
      courseTitle,
      coursePrice,
      userWhatsapp: normalized ? `+${normalized}` : SITE.phone,
    });

    return (
      <div className="courses-payment-success courses-enroll-pending">
        <MessageCircle className="courses-payment-success-icon" aria-hidden />
        <p className="courses-payment-success-title">Заявка жөнөтүлдү</p>
        <p className="courses-payment-success-text">
          WhatsAppка жаздыңыз. Андан кийин доступ мындай берилет:
        </p>
        <ol className="courses-enroll-steps">
          <li>Администратор төлөм реквизиттерин WhatsAppтан жөнөтөт.</li>
          <li>Төлөгөндөн кийин скриншот же ырастоону жибересиз.</li>
          <li>Төлөм текшерилгенден кийин сизди Telegram группасына кошот — сабактарга ушундан доступ ачылат.</li>
        </ol>
        <a
          href={reopenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary courses-payment-btn w-full"
        >
          WhatsAppты кайра ачуу
        </a>
        <button
          type="button"
          className="courses-payment-btn courses-enroll-unlock-btn w-full"
          onClick={handleUnlockAfterConfirm}
        >
          Админ кошкон — Telegramга өтүү
        </button>
        <p className="courses-payment-success-note">
          Администратор сизди группага кошкондон кийин гана басыңыз.
        </p>
      </div>
    );
  }

  return (
    <div className="courses-payment-block">
      <div className="courses-payment-top">
        <MessageCircle className="h-4 w-4" aria-hidden />
        <span className="courses-payment-title">WhatsApp менен катталуу</span>
      </div>
      <p className="courses-payment-price">{coursePrice}</p>
      <p className="courses-payment-hint">
        {lessonCount} сабак · номерди калтырып, WhatsAppка жазыңыз — төлөмдөн кийин Telegramдан доступ
        берилет
      </p>

      <label className="courses-enroll-whatsapp-label">
        <span>WhatsApp номериңиз</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+996 700 000 000"
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(e.target.value);
            if (whatsappError) setWhatsappError('');
          }}
          className="courses-enroll-whatsapp-input"
          disabled={status === 'sending'}
        />
      </label>
      {whatsappError ? <p className="courses-enroll-whatsapp-error">{whatsappError}</p> : null}

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
          disabled={status === 'sending'}
        />
        <span>Шарттар менен макулмун</span>
      </label>

      <button
        type="button"
        className="btn-primary courses-payment-btn w-full"
        onClick={handleEnrollWhatsapp}
        disabled={status === 'sending' || !termsAccepted || !whatsapp.trim()}
      >
        {status === 'sending' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            WhatsApp ачылууда...
          </>
        ) : (
          'WhatsAppка жазуу'
        )}
      </button>
    </div>
  );
}
