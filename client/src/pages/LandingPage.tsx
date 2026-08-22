import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Play, Mic, Video, Users, Calendar, Star,
} from 'lucide-react';
import {
  STATS, QUICK_ACCESS,
  EVENTS, TEACHER,
} from '../data/landing';
import { fetchCourses, fetchFreeLessons, formatCourseDuration } from '../lib/course-api';
import { fetchDailyQa, todayBishkek } from '../lib/qa-api';
import { DEFAULT_HERO, fetchHeroBanner } from '../lib/hero-api';
import { youtubeThumbnail } from '../lib/youtube';
import { FaqAccordion } from '../components/FaqAccordion';
import { ReviewsFeed } from '../components/ReviewsFeed';
import { UzorCorners } from '../components/UzorCorners';

const STAT_ICONS = [Mic, Video, Users, Calendar];

const KY_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;

function formatVideoDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}-${KY_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
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
  href: string;
  external?: boolean;
  date?: string;
  subtitle?: string;
  badge?: string;
  lessons?: number;
  rating?: number;
  price?: string;
};

function VideoPanelLink({
  href,
  external,
  className,
  children,
}: {
  href: string;
  external?: boolean;
  className: string;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

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

function DailyQaPanels() {
  const dayKey = todayBishkek();
  const { data: item, isLoading } = useQuery({
    queryKey: ['qa-daily', dayKey, 'queue'],
    queryFn: fetchDailyQa,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const question = (
    item?.question ?? item?.title ?? (isLoading ? 'Жүктөлүүдө...' : 'Суроо азырынча жок')
  ).trim();
  const answer = (
    item?.answer ?? item?.excerpt ?? (isLoading ? 'Жүктөлүүдө...' : 'Жооп азырынча жок')
  ).trim();
  const href = item ? `/questions/${item.slug ?? item.id}` : '/questions';

  return (
    <div className="ayah-hadith-grid">
      <Link to={href} id="ayah" className="ayah-panel no-underline">
        <h2 className="ayah-panel-title">Күндүн суроосу</h2>
        <div className="ayah-panel-body">
          <p className="ayah-translation">{question}</p>
        </div>
      </Link>

      <Link to={href} id="hadith" className="hadith-panel no-underline">
        <h2 className="hadith-panel-title">Күндүн жообу</h2>
        <div className="hadith-panel-body">
          <p className="hadith-text">{answer}</p>
        </div>
        <p className="hadith-sign">Мухаммадалим</p>
      </Link>
    </div>
  );
}

function PaidCoursesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['courses', 'paid'],
    queryFn: () => fetchCourses({ type: 'paid', limit: 100 }),
  });
  const items = data?.items ?? [];

  return (
    <div id="paid" className="ui-card p-5 sm:p-6 courses-section">
      <div className="panel-head">
        <h2 className="panel-title">Акылуу сабактар</h2>
        <span className="panel-head-line" aria-hidden="true" />
        <Link to="/courses" className="panel-link">Бардык курстар</Link>
      </div>
      <div className="courses-scroll">
        {isLoading ? (
          <p className="course-review-note m-0 px-1 py-6">Жүктөлүүдө...</p>
        ) : (
          items.map((course) => (
            <Link
              key={course.slug}
              to={`/courses/${course.slug}`}
              className="course-card no-underline"
            >
              <div className="course-card-video">
                <img
                  src={course.coverImage || youtubeThumbnail(course.introVideoId ?? 'mtKKIbWbRWc')}
                  alt={course.title}
                  className="course-card-img"
                />
                <div className="course-card-play">
                  <div className="play-circle-white">
                    <Play className="h-5 w-5 text-navy ml-0.5" fill="currentColor" />
                  </div>
                </div>
                <span className="video-paid-badge">{course.priceLabel}</span>
                <span className="course-card-duration">
                  {formatCourseDuration(course.introDurationSeconds)}
                </span>
              </div>
              <div className="course-card-body">
                <p className="course-card-title">{course.title}</p>
                <p className="course-card-intro">Киришүү сабак</p>
                <CourseMeta lessons={course.lessonCount} price={course.priceLabel} />
              </div>
            </Link>
          ))
        )}
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
          <Link to={linkHref} className="panel-link">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="videos-split">
        <VideoPanelLink href={featured.href} external={featured.external} className="video-main block no-underline">
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
        </VideoPanelLink>
        <div className="videos-side-wrap">
          <div className="videos-side-list">
          {sideItems.map((v) => (
            <VideoPanelLink
              key={v.id}
              href={v.href}
              external={v.external}
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
            </VideoPanelLink>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { data: hero } = useQuery({
    queryKey: ['hero-banner'],
    queryFn: fetchHeroBanner,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_HERO,
  });
  const banner = hero ?? DEFAULT_HERO;

  const { data: freeLessonsData, isLoading: freeVideosLoading } = useQuery({
    queryKey: ['free-lessons'],
    queryFn: fetchFreeLessons,
    staleTime: 5 * 60 * 1000,
  });

  const freeVideoItems = useMemo<VideoPanelItem[]>(() => {
    return (freeLessonsData?.items ?? []).map((lesson) => {
      const dateMatch = lesson.description?.match(/\d{4}-\d{2}-\d{2}/);
      return {
        id: lesson.id,
        title: lesson.title,
        duration: formatCourseDuration(lesson.durationSeconds),
        thumbnail: youtubeThumbnail(lesson.youtubeVideoId),
        href: `/courses/${lesson.courseSlug}/learn?lesson=${lesson.id}`,
        date: dateMatch ? dateMatch[0] : undefined,
        badge: 'Бекер',
      };
    });
  }, [freeLessonsData]);

  const featured = freeVideoItems[0];
  const sideVideos = freeVideoItems.slice(1);

  return (
    <>
      <section id="hero" className="hero-mosque">
        <img src={banner.skyImageUrl} alt="" className="hero-sky-photo" />
        <div className="hero-sky-text">
          <p className="hero-sky-title">{banner.title}</p>
          <p className="hero-sky-sub">{banner.subtitle}</p>
          <p className="hero-sky-name">{banner.name}</p>
        </div>
        <img src={banner.bannerImageUrl} alt="" className="hero-mosque-photo" />
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
            <ReviewsFeed />

            <DailyQaPanels />

            <VideoPanel
              id="videos"
              panelTitle="Акыркы баяндар"
              linkLabel="Бардык видеолор"
              linkHref="/courses/free"
              featured={
                featured ?? {
                  id: 'loading',
                  title: freeVideosLoading ? 'Жүктөлүүдө...' : 'Видеолор жок',
                  duration: '—',
                  thumbnail: youtubeThumbnail('ZkpJ1ezB2TI'),
                  href: '/courses/free',
                  badge: 'Бекер',
                }
              }
              sideItems={sideVideos}
            />

            <PaidCoursesSection />
          </div>
        </div>
      </section>

      <section className="events-faq-section">
        <div className="events-faq-bg" aria-hidden>
          <UzorCorners />
        </div>
        <div className="wrap events-faq-inner">
          <div className="events-faq-grid">
            <div id="events" className="events-panel">
              <h2 className="events-panel-title">Жакынкы иш-чаралар</h2>
              <div className="events-panel-body">
                {EVENTS.map((e) => (
                  <div key={e.title} className="event-row">
                    <div className="event-date">
                      <span className="event-date-num">{e.date}</span>
                      <span className="event-date-month">{e.month}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="event-row-title">{e.title}</p>
                      <p className="event-row-meta">{e.location} · {e.time}</p>
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
