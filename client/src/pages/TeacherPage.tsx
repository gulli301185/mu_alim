import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Calendar,
  Globe,
  GraduationCap,
  MapPin,
  Scale,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { TEACHER } from "../data/landing";
import { useSiteImages } from "../context/SiteImagesContext";
import { SITE_IMAGE_KEYS } from "../lib/site-images-api";

const WORK_ICONS = [BookOpen, Users, Briefcase] as const;

const USTAZ_HERO_STATS = [
  { icon: Calendar, primary: `${TEACHER.birthYear}-жылы`, secondary: "төрөлгөн" },
  { icon: Users, primary: "3 баланын", secondary: "атасы" },
  { icon: GraduationCap, primary: "15+ жыл", secondary: "тажрыйба" },
  { icon: Globe, primary: "5 тилде", secondary: "эркин сүйлөйт" },
] as const;

const INTEREST_ICONS = {
  book: BookOpen,
  grad: GraduationCap,
  scale: Scale,
  culture: Sparkles,
  search: Search,
} as const;

export function TeacherPage() {
  const { image } = useSiteImages();

  return (
    <>
      <section className="ustaz-page-hero">
        <img
          src={image(SITE_IMAGE_KEYS.teacherBanner)}
          alt={TEACHER.name}
          className="ustaz-page-banner-img"
        />
        <div className="ustaz-page-stats wrap" aria-label="Негизги фактылар">
          {USTAZ_HERO_STATS.map(({ icon: Icon, primary, secondary }) => (
            <div key={secondary} className="ustaz-page-stat">
              <Icon className="ustaz-page-stat-icon" aria-hidden />
              <div className="ustaz-page-stat-copy">
                <span className="ustaz-page-stat-primary">{primary}</span>
                <span className="ustaz-page-stat-secondary">{secondary}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="ustaz-profile" className="ustaz-page-body">
        <div className="wrap ustaz-page-grid">
          <article className="ustaz-page-card ustaz-page-card-bio">
            <h2 className="ustaz-page-card-title">Кыскача маалымат</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <div className="ustaz-page-bio">
              {TEACHER.bioParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </article>

          <article className="ustaz-page-card ustaz-page-card-timeline">
            <h2 className="ustaz-page-card-title">Билим алуу жолу</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ol className="ustaz-page-edu-timeline">
              {TEACHER.education.map((item) => (
                <li
                  key={`${item.period}-${item.place}`}
                  className="ustaz-page-edu-item"
                >
                  <span className="ustaz-page-edu-dot" aria-hidden />
                  <div className="ustaz-page-edu-copy">
                    <p className="ustaz-page-edu-period">{item.period}</p>
                    <p className="ustaz-page-edu-place">{item.place}</p>
                    <p className="ustaz-page-edu-city">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {item.city}
                    </p>
                    <p className="ustaz-page-edu-focus">{item.focus}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <article className="ustaz-page-card ustaz-page-card-work">
            <h2 className="ustaz-page-card-title">Илим тажрыйбасы</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ol className="ustaz-page-work-list">
              {TEACHER.workExperience.map((item, index) => {
                const Icon = WORK_ICONS[index % WORK_ICONS.length];
                return (
                  <li
                    key={`${item.period}-${item.role}`}
                    className="ustaz-page-work-item"
                  >
                    <span className="ustaz-page-work-icon-wrap">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="ustaz-page-work-copy">
                      <p className="ustaz-page-work-period">{item.period}</p>
                      <p className="ustaz-page-work-role">{item.role}</p>
                      <p className="ustaz-page-work-place">
                        {item.place}, {item.city}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>

          <article className="ustaz-page-card ustaz-page-card-langs">
            <h2 className="ustaz-page-card-title">Тилдер</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ul className="ustaz-page-lang-list">
              {TEACHER.languages.map((lang) => (
                <li key={lang.name} className="ustaz-page-lang-item">
                  <span className="ustaz-page-lang-name">{lang.name}</span>
                  <span className="ustaz-page-lang-dots" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < lang.dots
                            ? "ustaz-page-lang-dot is-filled"
                            : "ustaz-page-lang-dot"
                        }
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="ustaz-page-card ustaz-page-card-interests">
            <h2 className="ustaz-page-card-title">Кызыккан багыттар</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ul className="ustaz-page-interest-list">
              {TEACHER.interests.map((item) => {
                const Icon = INTEREST_ICONS[item.icon];
                return (
                  <li key={item.label} className="ustaz-page-interest-item">
                    <span className="ustaz-page-interest-icon-wrap">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>{item.label}</span>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>

        <div className="wrap">
          <Link to="/" className="ustaz-page-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Башкы бетке кайтуу
          </Link>
        </div>
      </section>
    </>
  );
}
