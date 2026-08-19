import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  HelpCircle,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { fetchQaList } from '../../lib/qa-api';

type StatCard = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  tone?: 'gold' | 'sky' | 'green';
};

const PLACEHOLDER_STATS: StatCard[] = [
  {
    label: 'Колдонуучулар',
    value: '—',
    hint: 'Катталган колдонуучулар',
    icon: Users,
    tone: 'sky',
  },
  {
    label: 'Активдүү колдонуучулар',
    value: '—',
    hint: 'Акыркы 30 күндө',
    icon: UserCheck,
    tone: 'green',
  },
  {
    label: 'Бекер курстар',
    value: '—',
    hint: 'Бекер курс саны',
    icon: BookOpen,
    tone: 'gold',
  },
  {
    label: 'Акы төлөнүүчү курстар',
    value: '—',
    hint: 'Платформадан',
    icon: BookOpen,
    tone: 'gold',
  },
  {
    label: 'Сатуу',
    value: '—',
    hint: 'Курс сатып алуулар',
    icon: ShoppingBag,
    tone: 'sky',
  },
  {
    label: 'Аякталган курстар',
    value: '—',
    hint: 'Ийгиликтүү бүткөн',
    icon: TrendingUp,
    tone: 'green',
  },
  {
    label: 'Сертификаттар',
    value: '—',
    hint: 'Берилген сертификаттар',
    icon: Award,
    tone: 'gold',
  },
];

export function AdminDashboardPage() {
  const [qaTotal, setQaTotal] = useState<number | null>(null);

  useEffect(() => {
    void fetchQaList({ page: 1, limit: 1 })
      .then((data) => setQaTotal(data.total))
      .catch(() => setQaTotal(null));
  }, []);

  return (
    <div className="admin-dashboard-page">
      <section className="admin-stats-grid">
        {PLACEHOLDER_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.label}
              className={`admin-stat-card admin-stat-card-${stat.tone ?? 'gold'}`}
            >
              <div className="admin-stat-icon">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="admin-stat-label">{stat.label}</p>
                <p className="admin-stat-value">{stat.value}</p>
                <p className="admin-stat-hint">{stat.hint}</p>
              </div>
            </article>
          );
        })}
        <article className="admin-stat-card admin-stat-card-sky">
          <div className="admin-stat-icon">
            <HelpCircle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="admin-stat-label">100 суроо-жооп</p>
            <p className="admin-stat-value">{qaTotal ?? '—'}</p>
            <p className="admin-stat-hint">Жарыяланган материалдар</p>
          </div>
        </article>
      </section>

      <section className="admin-quick-grid">
        <article className="ui-card admin-quick-card">
          <div className="admin-quick-head">
            <HelpCircle className="h-6 w-6 text-[var(--color-gold)]" aria-hidden />
            <div>
              <h2 className="admin-quick-title">100 суроо-жооп</h2>
              <p className="admin-quick-text">
                Суроолорду кошуу, өзгөртүү жана өчүрүү. ТЗ боюнча негизги контент бөлүмү.
              </p>
            </div>
          </div>
          <Link to="/admin/questions" className="btn-gold admin-quick-btn">
            Башкаруу
          </Link>
        </article>

        <article className="ui-card admin-quick-card admin-quick-card-muted">
          <h2 className="admin-quick-title">Жакында</h2>
          <p className="admin-quick-text">
            Курстар, сабактар, тесттер, сертификаттар, хадис жана пикирлер бөлүмдөрү ТЗ §25
            боюнча кошулат.
          </p>
          <ul className="admin-quick-list">
            <li>Колдонуучуларды башкаруу</li>
            <li>Курстар (сабактар менен)</li>
            <li>100 суроолук тест банки</li>
            <li>Сертификаттар жана статистика</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
