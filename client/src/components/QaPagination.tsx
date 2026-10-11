import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type QaPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function QaPagination({ currentPage, totalPages, onPageChange }: QaPaginationProps) {
  const { t } = useTranslation();
  const numsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const lastPage = totalPages;
  const middlePages =
    totalPages > 1 ? Array.from({ length: totalPages - 1 }, (_, index) => index + 1) : [1];

  useEffect(() => {
    if (currentPage === lastPage) return;
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [currentPage, lastPage]);

  if (totalPages <= 1) return null;

  return (
    <nav className="qa-pagination" aria-label={t('pagination.aria')}>
      <button
        type="button"
        className="qa-page-nav-btn qa-page-nav-btn-prev"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label={t('pagination.prev')}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="qa-page-nav-label">{t('pagination.prev')}</span>
      </button>

      <div className="qa-pagination-nums-wrap">
        <div ref={numsRef} className="qa-page-nums" role="group" aria-label={t('pagination.numbersAria')}>
          {middlePages.map((n) => (
            <button
              key={n}
              ref={n === currentPage ? activeRef : undefined}
              type="button"
              className={`qa-page-num${n === currentPage ? ' qa-page-num-active' : ''}`}
              onClick={() => onPageChange(n)}
              aria-current={n === currentPage ? 'page' : undefined}
            >
              {n}
            </button>
          ))}
        </div>

        {totalPages > 1 ? (
          <button
            type="button"
            className={`qa-page-num qa-page-num-last${
              currentPage === lastPage ? ' qa-page-num-active' : ''
            }`}
            onClick={() => onPageChange(lastPage)}
            aria-current={currentPage === lastPage ? 'page' : undefined}
            aria-label={t('pagination.lastPage', { page: lastPage })}
          >
            {lastPage}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        className="qa-page-nav-btn qa-page-nav-btn-next"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        aria-label={t('pagination.next')}
      >
        <span className="qa-page-nav-label">{t('pagination.next')}</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
