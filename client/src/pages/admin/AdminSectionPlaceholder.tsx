import { ADMIN_SECTION_META } from '../../data/admin-nav';

export function AdminSectionPlaceholder({ section }: { section: keyof typeof ADMIN_SECTION_META }) {
  const meta = ADMIN_SECTION_META[section];

  return (
    <section className="admin-placeholder">
      <div className="ui-card admin-placeholder-card">
        <p className="admin-placeholder-kicker">Жакында иштейт</p>
        <h2 className="admin-placeholder-title">{meta.title}</h2>
        <p className="admin-placeholder-subtitle">{meta.subtitle}</p>
        {meta.tzRef ? <p className="admin-placeholder-ref">{meta.tzRef}</p> : null}
      </div>
    </section>
  );
}
