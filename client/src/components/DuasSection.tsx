import { useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DUAS } from '../data/duas';
import { localizedList } from '../i18n/localizedList';

export function DuasSection() {
  const { t, i18n } = useTranslation();
  const meanings = localizedList(
    i18n,
    'duas.items',
    DUAS.map(({ translation, note }) => ({ translation, note })),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByRow = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ top: direction * 260, behavior: 'smooth' });
  };

  return (
    <section id="duas" className="duas-panel">
      <div className="duas-panel-head">
        <h2 className="duas-panel-title">{t('duas.title')}</h2>
        <div className="duas-nav">
          <button
            type="button"
            className="duas-nav-btn"
            onClick={() => scrollByRow(-1)}
            aria-label={t('common.up')}
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="duas-nav-btn"
            onClick={() => scrollByRow(1)}
            aria-label={t('common.down')}
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="duas-scroll" ref={scrollRef}>
        <div className="duas-grid">
          {DUAS.map((source, index) => {
            const dua = { ...source, ...meanings[index] };
            return (
            <article key={dua.id} className="dua-card">
              <span className="dua-number" aria-hidden>
                {index + 1}
              </span>
              <p className="dua-translit">{dua.transliteration}</p>
              <p className="dua-translation">{dua.translation}</p>
              {dua.note ? <p className="dua-note">{dua.note}</p> : null}
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
