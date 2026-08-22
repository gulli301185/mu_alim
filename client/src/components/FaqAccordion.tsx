import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ } from '../data/landing';

type FaqAccordionProps = {
  id?: string;
  className?: string;
  hideTitle?: boolean;
};

export function FaqAccordion({ id, className = '', hideTitle = false }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div id={id} className={`faq-panel ui-card ${className}`.trim()}>
      {!hideTitle && <h2 className="faq-panel-title">Суроо-жооп</h2>}
      <div className="faq-accordion">
        {FAQ.map((f, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={f.q} className={`faq-item ${isOpen ? 'faq-item-open' : ''}`}>
              <button
                type="button"
                className="faq-trigger"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span>{f.q}</span>
                <ChevronDown
                  className={`faq-chevron ${isOpen ? 'faq-chevron-open' : ''}`}
                  strokeWidth={2.75}
                />
              </button>
              <div className={`faq-content ${isOpen ? 'faq-content-open' : ''}`}>
                <p>{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
