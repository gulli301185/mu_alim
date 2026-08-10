import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Mic, Video, Users, Calendar, ChevronDown, MapPin, Clock, Phone, Mail,
} from 'lucide-react';
import {
  SITE, STATS, QUICK_ACCESS, FREE_VIDEOS, PAID_COURSES, PRAYER_TIMES, CITIES,
  HADITH, AYAH, EVENTS, TEACHER, SOCIAL, FAQ,
} from '../data/landing';

const STAT_ICONS = [Mic, Video, Users, Calendar];

function useCountdown(h: number, m: number) {
  const [t, setT] = useState('01:18:55');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const d = target.getTime() - now.getTime();
      setT(`${String(Math.floor(d / 3600000)).padStart(2, '0')}:${String(Math.floor((d % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((d % 60000) / 1000)).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [h, m]);
  return t;
}

function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith('/#')) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link to={href} className={className}>{children}</Link>;
}

export function LandingPage() {
  const [city, setCity] = useState<string>(CITIES[0]);
  const [sent, setSent] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const countdown = useCountdown(12, 45);

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
            <a href="#videos" className="btn-primary">БАЯНДАРДЫ КӨРҮҮ</a>
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

      <section className="py-10">
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

      <section className="py-8 bg-white">
        <div className="wrap">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div id="videos" className="ui-card p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="section-title">Акыркы баяндар</h2>
                <a href={SITE.youtubeFree} target="_blank" rel="noopener noreferrer" className="section-link">
                  Баарын көрүү →
                </a>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
                <a href={featured.url} target="_blank" rel="noopener noreferrer" className="video-main block no-underline">
                  <img src="/ustaz.png" alt={TEACHER.name} />
                  <div className="video-play">
                    <div className="play-circle">
                      <Play className="h-7 w-7 text-navy ml-1" fill="currentColor" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-navy-dark/90 to-transparent p-4">
                    <p className="text-white font-semibold text-sm">{featured.title}</p>
                    <p className="text-white/60 text-xs mt-1">{TEACHER.name}</p>
                  </div>
                </a>
                <div className="space-y-1">
                  {sideVideos.map((v) => (
                    <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="video-side-item no-underline">
                      <img src={v.thumbnail} alt={v.title} className="video-side-thumb" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy line-clamp-2 leading-snug">{v.title}</p>
                        <p className="text-xs text-muted mt-0.5">{v.date}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div id="prayer" className="ui-card p-5">
                <h2 className="section-title text-base mb-4">Намаз убакыттары</h2>
                <div className="relative mb-3">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <select className="select-field pl-9" value={city} onChange={(e) => setCity(e.target.value)}>
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                </div>
                <p className="text-xs text-muted mb-3">
                  {new Date().toLocaleDateString('ky-KG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {PRAYER_TIMES.map((p) => (
                  <div key={p.name} className={`prayer-row ${'active' in p && p.active ? 'prayer-active' : ''}`}>
                    <span className="font-medium text-navy">{p.name}</span>
                    <span className="font-bold text-navy">{p.time}</span>
                  </div>
                ))}
                <div className="countdown-box">
                  <p className="text-xs opacity-70 mb-2">Кийинки намаз — Бешим</p>
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-5 w-5 text-gold" />
                    <span className="countdown-num">{countdown}</span>
                  </div>
                  <p className="text-xs opacity-60 mt-2">{city}</p>
                </div>
              </div>

              <div id="paid" className="ui-card p-5">
                <h2 className="section-title text-base mb-4">Акылуу сабактар</h2>
                {PAID_COURSES.map((c) => (
                  <div key={c.title} className="paid-row">
                    <div>
                      <p className="text-sm font-semibold text-navy">{c.title}</p>
                      <p className="text-xs text-muted">{c.lessons} сабак · ★ {c.rating}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-gold">{c.price}</p>
                      <button className="btn-gold text-[10px] px-3 py-1.5 mt-1 rounded-lg">Кененирээк</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 bg-page">
        <div className="wrap">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div id="ayah" className="ui-card p-6">
              <h2 className="section-title text-base mb-4">Күндүн аяты</h2>
              <p className="ayah-arabic">{AYAH.arabic}</p>
              <p className="text-sm text-muted leading-relaxed">{AYAH.translation}</p>
              <p className="text-xs font-medium mt-3 text-gold">— {AYAH.source}</p>
              <button className="btn-primary mt-4 text-xs px-4 py-2">Кененирээк окуу</button>
            </div>

            <div id="hadith" className="ui-card p-6">
              <h2 className="section-title text-base mb-4">Күндүн хадиси</h2>
              <p className="hadith-text">{HADITH.text}</p>
              <p className="text-xs font-medium mt-4 text-gold">— {HADITH.source}</p>
            </div>

            <div id="events" className="ui-card p-6">
              <h2 className="section-title text-base mb-4">Жакынкы иш-чаралар</h2>
              {EVENTS.map((e) => (
                <div key={e.title} className="event-row">
                  <div className="event-date">
                    <span className="text-lg font-bold leading-none">{e.date}</span>
                    <span className="text-[10px] uppercase opacity-80">{e.month}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{e.title}</p>
                    <p className="text-xs text-muted">{e.location} · {e.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="ui-card p-6">
              <h2 className="section-title text-base mb-4">Социалдык тармактар</h2>
              <div className="flex flex-wrap gap-2 mb-5">
                {SOCIAL.map((s) => (
                  <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="social-btn" style={{ backgroundColor: s.color }}>
                    {s.name[0]}
                  </a>
                ))}
              </div>
              {subscribed ? (
                <p className="text-sm font-medium text-navy">Ийгиликтүү катталдыңыз!</p>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="space-y-2">
                  <input className="input-field" placeholder="Email дарегиңиз" type="email" required />
                  <button type="submit" className="btn-primary w-full">Катталуу</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Ustaz teaser */}
      <section className="py-10 bg-white">
        <div className="wrap">
          <Link to="/ustaz" className="ui-card p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 no-underline hover:shadow-md transition-shadow">
            <img src="/ustaz.png" alt={TEACHER.name} className="h-32 w-32 object-contain rounded-xl" />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-gold mb-1">Устаз</p>
              <h2 className="section-title text-lg mb-2">{TEACHER.name}</h2>
              <p className="text-sm text-muted italic">{TEACHER.quote}</p>
              <span className="inline-block mt-4 text-sm font-semibold text-gold">Кененирээк →</span>
            </div>
          </Link>
        </div>
      </section>

      <section id="faq" className="py-10 bg-page">
        <div className="wrap max-w-3xl">
          <h2 className="section-title mb-6">100 суроо-жооп</h2>
          {FAQ.map((f) => (
            <div key={f.q} className="ui-card p-5 mb-3">
              <p className="font-semibold text-navy text-sm mb-1">{f.q}</p>
              <p className="text-sm text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="contact-bg py-14">
        <div className="wrap">
          <div className="grid gap-10 lg:grid-cols-2 items-start">
            <div className="text-white">
              <h2 className="font-display text-3xl font-bold mb-3">Биз байланышта</h2>
              <p className="text-white/70 mb-6">Суроолоруңуз болсо, форманы толтуруңуз.</p>
              <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 text-white/80 hover:text-gold mb-3 no-underline">
                <Phone className="h-4 w-4" />{SITE.phone}
              </a>
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-white/80 hover:text-gold no-underline">
                <Mail className="h-4 w-4" />{SITE.email}
              </a>
            </div>
            <div className="ui-card p-6">
              {sent ? (
                <p className="text-center py-8 text-navy font-semibold">Каттыңыз ийгиликтүү жөнөтүлдү!</p>
              ) : (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
                  <input className="input-field" placeholder="Сиздин атыңыз" required />
                  <input className="input-field" placeholder="E-mail" type="email" required />
                  <textarea className="input-field h-28 resize-none" placeholder="Билдирүү..." required />
                  <button type="submit" className="btn-gold w-full">Жөнөтүү</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
