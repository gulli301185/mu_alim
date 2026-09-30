import { useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DUAS, DUAS_TITLE } from '../data/duas';

export function DuasSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByRow = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ top: direction * 260, behavior: 'smooth' });
  };

  return (
    <section id="duas" className="duas-panel">
      <div className="duas-panel-head">
        <h2 className="duas-panel-title">{DUAS_TITLE}</h2>
        <div className="duas-nav">
          <button
            type="button"
            className="duas-nav-btn"
            onClick={() => scrollByRow(-1)}
            aria-label="Жогору"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="duas-nav-btn"
            onClick={() => scrollByRow(1)}
            aria-label="Төмөн"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="duas-scroll" ref={scrollRef}>
        <div className="duas-grid">
          {DUAS.map((dua, index) => (
            <article key={dua.id} className="dua-card">
              <span className="dua-number" aria-hidden>
                {index + 1}
              </span>
              <p className="dua-translit">{dua.transliteration}</p>
              <p className="dua-translation">{dua.translation}</p>
              {dua.note ? <p className="dua-note">{dua.note}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
