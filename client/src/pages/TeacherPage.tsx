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
import { useTranslation } from "react-i18next";
import { TEACHER } from "../data/landing";
import { localizedList } from "../i18n/localizedList";
import { useSiteImages } from "../context/SiteImagesContext";
import { SITE_IMAGE_KEYS } from "../lib/site-images-api";

const WORK_ICONS = [BookOpen, Users, Briefcase] as const;

const USTAZ_HERO_STATS = [
  { icon: Calendar, key: "Born" },
  { icon: Users, key: "Kids" },
  { icon: GraduationCap, key: "Exp" },
  { icon: Globe, key: "Langs" },
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
  const { t, i18n } = useTranslation();
  const bioParagraphs = localizedList(i18n, "teacherData.bioParagraphs", TEACHER.bioParagraphs);
  const eduText = localizedList(i18n, "teacherData.education", TEACHER.education);
  const workText = localizedList(i18n, "teacherData.workExperience", TEACHER.workExperience);
  const langNames = localizedList(
    i18n,
    "teacherData.languages",
    TEACHER.languages.map((l) => l.name),
  );
  const interestLabels = localizedList(
    i18n,
    "teacherData.interests",
    TEACHER.interests.map((i) => i.label),
  );

  return (
    <>
      <section className="ustaz-page-hero">
        <img
          src={image(SITE_IMAGE_KEYS.teacherBanner)}
          alt={TEACHER.name}
          className="ustaz-page-banner-img"
        />
        <div className="ustaz-page-stats wrap" aria-label={t("teacher.factsAria")}>
          {USTAZ_HERO_STATS.map(({ icon: Icon, key }) => (
            <div key={key} className="ustaz-page-stat">
              <Icon className="ustaz-page-stat-icon" aria-hidden />
              <div className="ustaz-page-stat-copy">
                <span className="ustaz-page-stat-primary">
                  {t(`teacher.stat${key}Primary`, { year: TEACHER.birthYear })}
                </span>
                <span className="ustaz-page-stat-secondary">{t(`teacher.stat${key}Secondary`)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="ustaz-profile" className="ustaz-page-body">
        <div className="wrap ustaz-page-grid">
          <article className="ustaz-page-card ustaz-page-card-bio">
            <h2 className="ustaz-page-card-title">{t("teacher.bioTitle")}</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <div className="ustaz-page-bio">
              {bioParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
          </article>

          <article className="ustaz-page-card ustaz-page-card-timeline">
            <h2 className="ustaz-page-card-title">{t("teacher.eduTitle")}</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ol className="ustaz-page-edu-timeline">
              {TEACHER.education.map((source, index) => {
                const item = { ...source, ...eduText[index] };
                return (
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
                );
              })}
            </ol>
          </article>

          <article className="ustaz-page-card ustaz-page-card-work">
            <h2 className="ustaz-page-card-title">{t("teacher.workTitle")}</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ol className="ustaz-page-work-list">
              {TEACHER.workExperience.map((source, index) => {
                const item = { ...source, ...workText[index] };
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
            <h2 className="ustaz-page-card-title">{t("teacher.langsTitle")}</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ul className="ustaz-page-lang-list">
              {TEACHER.languages.map((lang, index) => (
                <li key={lang.name} className="ustaz-page-lang-item">
                  <span className="ustaz-page-lang-name">{langNames[index] ?? lang.name}</span>
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
            <h2 className="ustaz-page-card-title">{t("teacher.interestsTitle")}</h2>
            <div className="ustaz-page-card-divider" aria-hidden />
            <ul className="ustaz-page-interest-list">
              {TEACHER.interests.map((item, index) => {
                const Icon = INTEREST_ICONS[item.icon];
                return (
                  <li key={item.label} className="ustaz-page-interest-item">
                    <span className="ustaz-page-interest-icon-wrap">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>{interestLabels[index] ?? item.label}</span>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>

        <div className="wrap">
          <Link to="/" className="ustaz-page-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("common.back")}
          </Link>
        </div>
      </section>
    </>
  );
}
