import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookOpen,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  ScrollText,
  Star,
  UserCircle,
  Users,
} from 'lucide-react';

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  description?: string;
};

export type AdminNavGroup = {
  title?: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    items: [
      {
        to: '/admin',
        label: 'Башкы панель',
        icon: LayoutDashboard,
        end: true,
        description: 'Платформа статистикасы',
      },
    ],
  },
  {
    title: 'Башкаруу',
    items: [
      {
        to: '/admin/users',
        label: 'Колдонуучулар',
        icon: Users,
        description: 'Колдонуучулар, блоктоо, прогресс',
      },
      {
        to: '/admin/courses',
        label: 'Курстар',
        icon: BookOpen,
        description: 'Курстар жана YouTube сабактар',
      },
      {
        to: '/admin/tests',
        label: 'Тесттер',
        icon: ClipboardList,
        description: '100 суроо банки жана тесттер',
      },
      {
        to: '/admin/certificates',
        label: 'Сертификаттар',
        icon: Award,
        description: 'Берилген сертификаттар',
      },
    ],
  },
  {
    title: 'Контент',
    items: [
      {
        to: '/admin/questions',
        label: '100 суроо-жооп',
        icon: HelpCircle,
        description: 'Суроо-жооп бөлүмүн башкаруу',
      },
      {
        to: '/admin/hadiths',
        label: 'Хадис күнү',
        icon: ScrollText,
        description: 'Хадистерди башкаруу',
      },
      {
        to: '/admin/teacher',
        label: 'Мугалим',
        icon: UserCircle,
        description: 'Мугалим жөнүндө маалымат',
      },
      {
        to: '/admin/reviews',
        label: 'Пикирлер',
        icon: Star,
        description: 'Отзывдарды модерациялоо',
      },
    ],
  },
];

export const ADMIN_SECTION_META: Record<
  string,
  { title: string; subtitle: string; tzRef?: string }
> = {
  users: {
    title: 'Колдонуучулар',
    subtitle: 'Колдонуучуларды көрүү, издөө, блоктоо жана прогрессти көзөмөлдөө',
    tzRef: 'ТЗ §25 — Колдонуучуларды башкаруу',
  },
  courses: {
    title: 'Курстар',
    subtitle: 'Курстар, YouTube сабактар, баа жана жарыялоо',
    tzRef: 'ТЗ §25 — Курстарды башкаруу',
  },
  tests: {
    title: 'Тесттер',
    subtitle: 'Акылуу курстар үчүн финалдык тест түзүү (А-Б-В-Г жана текст жооп)',
    tzRef: 'ТЗ §25 — Тесттерди башкаруу',
  },
  certificates: {
    title: 'Сертификаттар',
    subtitle: 'Берилген сертификаттарды көрүү жана текшерүү',
    tzRef: 'ТЗ §25 — Сертификаттар',
  },
  hadiths: {
    title: 'Хадис күнү',
    subtitle: 'Күнүмдүк хадистерди кошуу, өзгөртүү жана өчүрүү',
    tzRef: 'ТЗ §20, §25',
  },
  teacher: {
    title: 'Мугалим',
    subtitle: 'Мугалимдин биографиясы, билими жана соцтармактар',
    tzRef: 'ТЗ §21, §25',
  },
  reviews: {
    title: 'Пикирлер',
    subtitle: 'Курс пикирлерин модерациялоо',
    tzRef: 'ТЗ §17, §25',
  },
};

export function findAdminNavItem(pathname: string): AdminNavItem | undefined {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.end && pathname === item.to) return item;
      if (!item.end && (pathname === item.to || pathname.startsWith(`${item.to}/`))) return item;
    }
  }
  return undefined;
}
