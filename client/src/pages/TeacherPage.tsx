import { Link } from 'react-router-dom';
import {
  GraduationCap,
  MapPin,
  ArrowLeft,
  Briefcase,
  Languages,
  User,
  Info,
} from 'lucide-react';
import { TEACHER } from '../data/landing';

export function TeacherPage() {
  return (
    <>
      <section className="teacher-hero">
        <div className="wrap teacher-hero-grid">
          <div className="teacher-photo-wrap">
            <img src="/ustaz.png?v=4" alt={TEACHER.name} className="teacher-photo" />
          </div>
          <div className="teacher-quote-panel">
            <span className="teacher-quote-mark">"</span>
            <p className="teacher-quote-main">{TEACHER.quote}</p>
            {TEACHER.quoteSub ? (
              <p className="teacher-quote-sub">{TEACHER.quoteSub}</p>
            ) : null}
            <p className="teacher-signature">{TEACHER.shortName}</p>
          </div>
        </div>
      </section>

      <section className="teacher-profile-page">
        <div className="wrap teacher-profile-wrap">
          <div className="teacher-profile-intro-block">
            <p className="teacher-profile-label">Устаз жөнүндө</p>
            <h1 className="teacher-profile-name">{TEACHER.name}</h1>
            <p className="teacher-profile-role">{TEACHER.role}</p>
            <p className="teacher-profile-institute">{TEACHER.institute}</p>
          </div>

          <div className="teacher-profile-body">
            <article className="teacher-profile-card teacher-profile-bio-card">
              <h2 className="teacher-profile-card-title">
                <User className="h-5 w-5" />
                Жеке сапаттар
              </h2>
              <p className="teacher-profile-bio">{TEACHER.personalQualities}</p>
            </article>

            <article className="teacher-profile-card">
              <h2 className="teacher-profile-card-title">
                <GraduationCap className="h-5 w-5" />
                Билим алуу
              </h2>
              <ol className="teacher-education-list">
                {TEACHER.education.map((item) => (
                  <li key={`${item.period}-${item.place}`} className="teacher-education-item">
                    <span className="teacher-education-period">{item.period}</span>
                    <div className="teacher-education-content">
                      <p className="teacher-education-place">{item.place}</p>
                      <p className="teacher-education-city">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {item.city}
                      </p>
                      <p className="teacher-education-focus">{item.focus}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            <article className="teacher-profile-card">
              <h2 className="teacher-profile-card-title">
                <Briefcase className="h-5 w-5" />
                Иш тажрыйбасы
              </h2>
              <ol className="teacher-education-list">
                {TEACHER.workExperience.map((item) => (
                  <li key={`${item.period}-${item.role}`} className="teacher-education-item">
                    <span className="teacher-education-period">{item.period}</span>
                    <div className="teacher-education-content">
                      <p className="teacher-education-place">{item.role}</p>
                      <p className="teacher-education-city">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {item.place}, {item.city}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            <div className="teacher-profile-two-col">
              <article className="teacher-profile-card">
                <h2 className="teacher-profile-card-title">
                  <Languages className="h-5 w-5" />
                  Тилдер
                </h2>
                <ul className="teacher-language-list">
                  {TEACHER.languages.map((lang) => (
                    <li key={lang.name} className="teacher-language-item">
                      <span className="teacher-language-name">{lang.name}</span>
                      <span className="teacher-language-level">{lang.level}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="teacher-profile-card">
                <h2 className="teacher-profile-card-title">
                  <Info className="h-5 w-5" />
                  Кошумча маалымат
                </h2>
                <ul className="teacher-extra-list">
                  {TEACHER.additionalInfo.map((info) => (
                    <li key={info} className="teacher-extra-item">
                      {info}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>

          <Link to="/" className="teacher-profile-back">
            <ArrowLeft className="h-4 w-4" />
            Башкы бетке кайтуу
          </Link>
        </div>
      </section>
    </>
  );
}
