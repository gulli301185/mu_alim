import { Link } from 'react-router-dom';
import { Play, GraduationCap, BookOpen, Youtube } from 'lucide-react';
import { TEACHER, FREE_VIDEOS, PAID_COURSES, SITE } from '../data/landing';

export function TeacherPage() {
  return (
    <>
      {/* Hero quote section */}
      <section className="teacher-hero">
        <div className="wrap teacher-hero-grid">
          <div className="teacher-photo-wrap">
            <img src="/ustaz.png" alt={TEACHER.name} className="teacher-photo" />
          </div>
          <div className="teacher-quote-panel">
            <span className="teacher-quote-mark">"</span>
            <p className="teacher-quote-main">{TEACHER.quote}</p>
            <p className="teacher-quote-sub">{TEACHER.quoteSub}</p>
            <p className="teacher-signature">{TEACHER.shortName}</p>
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="py-12 bg-white">
        <div className="wrap max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-widest mb-2 text-gold">Устаз жөнүндө</p>
          <h1 className="section-title mb-2">{TEACHER.name}</h1>
          <p className="text-sm font-medium text-navy mb-1">{TEACHER.role}</p>
          <p className="text-sm text-muted mb-6">{TEACHER.institute}</p>
          <p className="text-muted leading-relaxed">{TEACHER.bio}</p>

          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {TEACHER.stats.map((s) => (
              <div key={s.label} className="ui-card p-5 text-center">
                <p className="text-2xl font-bold text-navy">{s.value}</p>
                <p className="text-xs text-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-10 bg-page">
        <div className="wrap max-w-4xl">
          <h2 className="section-title mb-6">Илим багыты</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {TEACHER.topics.map((t) => (
              <div key={t.title} className="ui-card p-5 flex gap-4 items-start">
                <div className="teacher-topic-icon">
                  {t.icon === 'book' ? <BookOpen className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{t.title}</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Videos */}
      <section className="py-10 bg-white">
        <div className="wrap">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Акыркы баяндар</h2>
            <a href={SITE.youtubeFree} target="_blank" rel="noopener noreferrer" className="section-link flex items-center gap-1">
              <Youtube className="h-4 w-4" /> YouTube канал
            </a>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FREE_VIDEOS.map((v) => (
              <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="ui-card overflow-hidden no-underline group">
                <div className="relative aspect-video">
                  <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-navy/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="play-circle scale-75">
                      <Play className="h-5 w-5 text-navy ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium text-navy line-clamp-2">{v.title}</p>
                  <p className="text-xs text-muted mt-1">{v.date}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="py-10 bg-page">
        <div className="wrap max-w-4xl">
          <h2 className="section-title mb-6">Акылуу курстар</h2>
          <div className="space-y-3">
            {PAID_COURSES.map((c) => (
              <div key={c.title} className="ui-card p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy">{c.title}</p>
                  <p className="text-xs text-muted mt-1">{c.lessons} сабак · ★ {c.rating}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gold">{c.price}</p>
                  <button className="btn-gold text-xs px-4 py-2 mt-2">Катталуу</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/" className="btn-primary">Башкы бетке кайтуу</Link>
          </div>
        </div>
      </section>
    </>
  );
}
