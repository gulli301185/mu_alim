import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

/** Site-wide fallback for public URLs that match no route (header and footer come from PublicLayout). */
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="courses-page">
      <div className="wrap courses-page-inner">
        <p className="courses-page-subtitle">{t('common.pageNotFound')}</p>
        <Link to="/" className="courses-page-back">
          <ArrowLeft className="h-4 w-4" />
          {t('nav.home')}
        </Link>
      </div>
    </section>
  );
}
