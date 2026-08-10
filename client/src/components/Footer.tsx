import { Link } from 'react-router-dom';
import { SITE } from '../data/landing';

export function Footer() {
  return (
    <footer className="footer-bg text-white py-10">
      <div className="wrap flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 no-underline text-white">
          <img src="/logo-mualim.png" alt="" className="h-10 bg-white rounded-lg p-1" />
          <div>
            <p className="font-bold text-sm">{SITE.name}</p>
            <p className="text-xs text-white/50">{SITE.tagline}</p>
          </div>
        </Link>
        <p className="text-xs text-white/40">© 2024 {SITE.name} — Бардык укуктар корголгон.</p>
      </div>
    </footer>
  );
}
