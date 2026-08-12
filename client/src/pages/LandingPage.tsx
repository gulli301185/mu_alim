import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Mic, Video, Users, Calendar, ChevronDown, MapPin, Star,
} from 'lucide-react';
import {
  SITE, STATS, QUICK_ACCESS, FREE_VIDEOS, PAID_COURSES, PRAYER_TIMES, CITIES,
  HADITH, AYAH, EVENTS, TEACHER,
} from '../data/landing';
import { FaqAccordion } from '../components/FaqAccordion';

const STAT_ICONS = [Mic, Video, Users, Calendar];

const KY_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;

function formatVideoDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}-${KY_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

function formatPrayerDate(date: Date) {
  return `${date.getDate()}-${KY_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

function useCountdown(h: number, m: number) {
  const [parts, setParts] = useState({ h: '01', m: '18', s: '55' });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const d = target.getTime() - now.getTime();
      setParts({
        h: String(Math.floor(d / 3600000)).padStart(2, '0'),
        m: String(Math.floor((d % 3600000) / 60000)).padStart(2, '0'),
        s: String(Math.floor((d % 60000) / 1000)).padStart(2, '0'),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [h, m]);
  return parts;
}

function PrayerIcon() {
  return (
    <span className="prayer-icon" aria-hidden="true">
      <svg viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="17" fill="#f4f6fa" stroke="#e8edf4" strokeWidth="1" />
        <path
          d="M18 8c-3.5 0-6 2.2-6 5.2v1.1h12v-1.1C24 10.2 21.5 8 18 8Z"
          fill="var(--color-gold)"
          opacity="0.85"
        />
        <path
          d="M10 16.5h16v9.5c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5v-9.5Z"
          fill="var(--color-navy)"
          opacity="0.75"
        />
        <rect x="16.5" y="21" width="3" height="6" rx="0.5" fill="var(--color-navy)" opacity="0.6" />
        <circle cx="26" cy="11" r="3.5" fill="var(--color-gold)" opacity="0.55" />
      </svg>
    </span>
  );
}

function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith('/#')) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link to={href} className={className}>{children}</Link>;
}

type VideoPanelItem = {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
  date?: string;
  subtitle?: string;
  badge?: string;
  lessons?: number;
  rating?: number;
  price?: string;
};

function StarRating({ value }: { value: number }) {
  return (
    <span className="course-stars" aria-label={`${value} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`course-star ${i < Math.round(value) ? 'course-star-filled' : ''}`}
          fill={i < Math.round(value) ? 'currentColor' : 'none'}
          strokeWidth={1.75}
        />
      ))}
      <span className="course-rating-num">{value}</span>
    </span>
  );
}

function CourseMeta({ lessons, rating, price }: { lessons?: number; rating?: number; price?: string }) {
  if (!lessons && !rating && !price) return null;
  return (
    <div className="course-meta">
      {(lessons || rating) && (
        <p className="course-meta-row">
          {rating != null && <StarRating value={rating} />}
          {lessons != null && <span className="course-lessons">{lessons} сабак</span>}
        </p>
      )}
      {price && <p className="course-price">{price}</p>}
    </div>
  );
}

function FaqAccordionSection() {
  return <FaqAccordion id="faq" />;
}

function PaidCoursesSection() {
  return (
    <div id="paid" className="ui-card p-5 sm:p-6 courses-section">
      <div className="panel-head">
        <h2 className="panel-title">Акылуу сабактар</h2>
        <span className="panel-head-line" aria-hidden="true" />
        <Link to="/courses" className="panel-link">Бардык курстар</Link>
      </div>
      <div className="courses-scroll">
        {PAID_COURSES.map((c) => (
          <a
            key={c.id}
            href={c.intro.url}
            target="_blank"
            rel="noopener noreferrer"
            className="course-card no-underline"
          >
            <div className="course-card-video">
              <img src={c.intro.thumbnail} alt={c.title} className="course-card-img" />
              <div className="course-card-play">
                <div className="play-circle-white">
                  <Play className="h-5 w-5 text-navy ml-0.5" fill="currentColor" />
                </div>
              </div>
              <span className="video-free-badge">Бекер</span>
              <span className="course-card-duration">{c.intro.duration}</span>
            </div>
            <div className="course-card-body">
              <p className="course-card-title">{c.title}</p>
              <p className="course-card-intro">{c.intro.title} · Бекер</p>
              <CourseMeta lessons={c.lessons} rating={c.rating} price={c.price} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function VideoPanel({
  id,
  panelTitle,
  linkLabel,
  linkHref,
  featured,
  sideItems,
}: {
  id?: string;
  panelTitle: string;
  linkLabel: string;
  linkHref: string;
  featured: VideoPanelItem;
  sideItems: VideoPanelItem[];
}) {
  return (
    <div id={id} className="ui-card p-5 sm:p-6 main-panel main-panel-videos">
      <div className="panel-head">
        <h2 className="panel-title">{panelTitle}</h2>
        <span className="panel-head-line" aria-hidden="true" />
        {linkHref.startsWith('http') ? (
          <a href={linkHref} target="_blank" rel="noopener noreferrer" className="panel-link">
            {linkLabel}
          </a>
        ) : (
          <a href={linkHref} className="panel-link">
            {linkLabel}
          </a>
        )}
      </div>
      <div className="videos-split">
        <a
          href={featured.url}
          target="_blank"
          rel="noopener noreferrer"
          className="video-main block no-underline"
        >
          <img src={featured.thumbnail} alt={featured.title} />
          <div className="video-play">
            <div className="play-circle-white">
              <Play className="h-6 w-6 text-navy ml-0.5" fill="currentColor" />
            </div>
          </div>
          {featured.badge && <span className="video-free-badge">{featured.badge}</span>}
          <span className="video-duration">{featured.duration}</span>
          {(featured.lessons || featured.rating || featured.price) && (
            <div className="video-main-meta">
              <p className="video-main-meta-title">{featured.title}</p>
              <CourseMeta
                lessons={featured.lessons}
                rating={featured.rating}
                price={featured.price}
              />
            </div>
          )}
        </a>
        <div className="videos-side-list">
          {sideItems.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="video-side-item no-underline"
            >
              <div className="video-side-thumb-wrap">
                <img src={v.thumbnail} alt={v.title} className="video-side-thumb" />
                <div className="video-side-play">
                  <Play className="h-3 w-3 text-white" fill="currentColor" />
                </div>
                <span className="video-side-duration">{v.duration}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="video-side-title">{v.title}</p>
                {v.subtitle && <p className="video-side-subtitle">{v.subtitle}</p>}
                {(v.lessons || v.rating || v.price) ? (
                  <CourseMeta lessons={v.lessons} rating={v.rating} price={v.price} />
                ) : (
                  v.date && <p className="video-side-date">{formatVideoDate(v.date)}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [city, setCity] = useState<string>(CITIES[0]);
  const countdown = useCountdown(13, 10);
  const today = new Date();

  const featured = FREE_VIDEOS[0];
  const sideVideos = FREE_VIDEOS.slice(1, 5);

  return (
    <>
      <section id="hero" className="hero-mosque">
        <div className="wrap hero-inner">
          <h1 className="hero-title max-w-2xl">
            Билим аркылуу<br />жакшы жашоого кадам
          </h1>
          <p className="hero-sub">
            Куран жана Сүннөттүн негизинде ишенимдүү материалдар. Бекер YouTube баяндар жана акылуу онлайн курстар.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <a href="#videos" className="btn-gold">БАЯНДАРДЫ КӨРҮҮ</a>
            <a href="#videos" className="btn-outline">АКЫРКЫ ВИДЕО</a>
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="stats-bar grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s, i) => {
            const Icon = STAT_ICONS[i];
            return (
              <div key={s.label} className="flex items-center gap-3">
                <div className="stat-icon"><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-lg font-bold text-navy">{s.value}</p>
                  <p className="text-xs text-muted">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="py-8">
        <div className="wrap">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {QUICK_ACCESS.map((item) => (
              <NavLink key={item.label} href={item.href} className="quick-card no-underline">
                <div className="quick-icon">{item.emoji}</div>
                <span className="text-xs sm:text-sm font-semibold text-navy">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </section>

      <section className="py-4 bg-page">
        <div className="wrap">
          <div className="main-split">
            <div className="prayer-faith-row">
              <div id="prayer" className="ui-card prayer-panel main-panel-prayer">
              <div className="prayer-panel-head">
                <h2 className="prayer-panel-title">Намаз убакыттары</h2>
                <div className="prayer-city-select">
                  <MapPin className="h-4 w-4 text-gold shrink-0" />
                  <select
                    className="prayer-city-input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    aria-label="Шаар"
                  >
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="h-4 w-4 text-sky-dark shrink-0 pointer-events-none" />
                </div>
                <span className="prayer-head-date">{formatPrayerDate(today)}</span>
              </div>
              <div className="prayer-split">
                <div className="prayer-list">
                  {PRAYER_TIMES.map((p) => (
                    <div key={p.name} className="prayer-row">
                      <div className="prayer-row-left">
                        <PrayerIcon />
                        <span className="prayer-name">{p.name}</span>
                      </div>
                      <span className="prayer-time">{p.time}</span>
                    </div>
                  ))}
                </div>

                <div className="countdown-box">
                  <img
                    src="/mosque-hero.jpg"
                    alt=""
                    className="countdown-mosque"
                    aria-hidden="true"
                  />
                  <p className="countdown-label">Кийинки намазга чейин</p>
                  <div className="countdown-timer">
                    <div className="countdown-segment">
                      <span className="countdown-num">{countdown.h}</span>
                      <span className="countdown-unit">СААТ</span>
                    </div>
                    <span className="countdown-colon">:</span>
                    <div className="countdown-segment">
                      <span className="countdown-num">{countdown.m}</span>
                      <span className="countdown-unit">МИНУТ</span>
                    </div>
                    <span className="countdown-colon">:</span>
                    <div className="countdown-segment">
                      <span className="countdown-num">{countdown.s}</span>
                      <span className="countdown-unit">СЕКУНДА</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              <div className="ayah-hadith-grid">
              <div id="ayah" className="ayah-panel">
                <h2 className="ayah-panel-title">Күндүн аяты</h2>
                <div className="ayah-panel-body">
                  <p className="ayah-translation">{AYAH.translation}</p>
                  <p className="ayah-source">— {AYAH.source}</p>
                </div>
              </div>

              <div id="hadith" className="hadith-panel">
                <h2 className="hadith-panel-title">Күндүн хадиси</h2>
                <div className="hadith-panel-body">
                  <p className="hadith-text">{HADITH.text}</p>
                  <p className="hadith-source">— {HADITH.source}</p>
                </div>
              </div>
              </div>
            </div>

            <VideoPanel
              id="videos"
              panelTitle="Акыркы баяндар"
              linkLabel="Бардык видеолор"
              linkHref={SITE.youtubeFree}
              featured={{
                id: featured.id,
                title: featured.title,
                duration: featured.duration,
                thumbnail: featured.thumbnail,
                url: featured.url,
              }}
              sideItems={sideVideos.map((v) => ({
                id: v.id,
                title: v.title,
                duration: v.duration,
                thumbnail: v.thumbnail,
                url: v.url,
                date: v.date,
              }))}
            />

            <PaidCoursesSection />
          </div>
        </div>
      </section>

      <section className="events-faq-section">
        <div className="events-faq-bg" aria-hidden />
        <div className="wrap events-faq-inner">
          <div className="events-faq-grid">
            <div id="events" className="events-panel">
              <h2 className="events-panel-title">Жакынкы иш-чаралар</h2>
              <div className="events-panel-body">
                {EVENTS.map((e) => (
                  <div key={e.title} className="event-row">
                    <div className="event-date">
                      <span className="text-lg font-bold leading-none">{e.date}</span>
                      <span className="text-[10px] uppercase opacity-80">{e.month}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{e.title}</p>
                      <p className="text-xs text-muted">{e.location} · {e.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <FaqAccordionSection />
          </div>
        </div>
      </section>

      <section className="ustaz-section">
        <div className="wrap">
          <div className="ustaz-teaser-card">
              <div className="ustaz-teaser-photo-wrap">
                <img
                  src="/ustaz-blue.png?v=3"
                  alt={TEACHER.quote}
                  className="ustaz-teaser-photo"
                />
              </div>

              <div className="ustaz-teaser-wave" aria-hidden>
                <svg className="ustaz-wave-svg" viewBox="0 0 1440 120" preserveAspectRatio="none">
                  <path
                    d="M0,80 L0,120 L1440,120 L1440,20 C1200,60 960,0 720,40 C480,80 240,20 0,80 Z"
                    className="ustaz-wave-path-back"
                  />
                </svg>
                <svg className="ustaz-wave-svg ustaz-wave-svg-front" viewBox="0 0 1440 100" preserveAspectRatio="none">
                  <path
                    d="M0,70 L0,100 L1440,100 L1440,0 C1080,50 720,10 360,55 C180,75 60,65 0,70 Z"
                    className="ustaz-wave-path-front"
                  />
                </svg>
              </div>

              <div className="ustaz-teaser-body">
                <p className="ustaz-teaser-label">Устаз жөнүндө</p>
                <h2 className="ustaz-teaser-name">{TEACHER.name}</h2>
                <p className="ustaz-teaser-text">{TEACHER.teaserBio}</p>
                <Link to="/ustaz" className="btn-gold ustaz-teaser-btn">
                  Кененирээк
                </Link>
              </div>
          </div>
        </div>
      </section>
    </>
  );
}
