import { Mail, MapPin, Phone, X } from 'lucide-react';
import { SITE, SOCIAL } from '../data/landing';

type ContactPanelProps = {
  open: boolean;
  onClose: () => void;
};

const EXTRA_CONTACTS = [
  {
    label: 'WhatsApp',
    href: `https://wa.me/${SITE.whatsappDigits}`,
    external: true,
  },
  {
    label: 'YouTube',
    href: SITE.youtubeFree,
    external: true,
  },
  {
    label: 'Instagram',
    href: SITE.instagram,
    external: true,
  },
  {
    label: 'Telegram (акылуу курстар)',
    href: SITE.paidTelegramInvite,
    external: true,
  },
] as const;

export function ContactPanel({ open, onClose }: ContactPanelProps) {
  if (!open) return null;

  return (
    <div
      className="contact-panel-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-panel-title"
    >
      <aside className="contact-panel">
        <header className="contact-panel-head">
          <h2 id="contact-panel-title" className="contact-panel-title">
            Байланыш
          </h2>
          <button type="button" className="contact-panel-close" onClick={onClose} aria-label="Жабуу">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <ul className="contact-panel-list">
          <li>
            <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="contact-panel-item">
              <span className="contact-panel-icon">
                <Phone className="h-5 w-5" aria-hidden />
              </span>
              <span className="contact-panel-copy">
                <span className="contact-panel-label">Телефон</span>
                <span className="contact-panel-value">{SITE.phone}</span>
              </span>
            </a>
          </li>
          <li>
            <a href={`mailto:${SITE.email}`} className="contact-panel-item">
              <span className="contact-panel-icon">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <span className="contact-panel-copy">
                <span className="contact-panel-label">Email</span>
                <span className="contact-panel-value">{SITE.email}</span>
              </span>
            </a>
          </li>
          <li>
            <div className="contact-panel-item contact-panel-item-static">
              <span className="contact-panel-icon">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <span className="contact-panel-copy">
                <span className="contact-panel-label">Дарек</span>
                <span className="contact-panel-value">{SITE.address}</span>
              </span>
            </div>
          </li>
        </ul>

        <div className="contact-panel-section">
          <p className="contact-panel-section-title">Тез байланыш</p>
          <ul className="contact-panel-links">
            {EXTRA_CONTACTS.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="contact-panel-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="contact-panel-section">
          <p className="contact-panel-section-title">Социалдык тармактар</p>
          <ul className="contact-panel-links">
            {SOCIAL.map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="contact-panel-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
