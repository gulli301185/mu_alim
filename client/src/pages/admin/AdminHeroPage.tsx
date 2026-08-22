import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_HERO,
  fetchHeroBanner,
  updateHeroBanner,
  type HeroBanner,
} from '../../lib/hero-api';
import { getErrorMessage, toastError, toastSuccess } from '../../lib/toast';

export function AdminHeroPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<HeroBanner>(DEFAULT_HERO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchHeroBanner()
      .then(setForm)
      .catch((err) => toastError(getErrorMessage(err, 'Баннер жүктөлгөн жок')))
      .finally(() => setLoading(false));
  }, []);

  const setField = (key: keyof HeroBanner, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const saved = await updateHeroBanner(token, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        name: form.name.trim(),
        skyImageUrl: form.skyImageUrl.trim(),
        bannerImageUrl: form.bannerImageUrl.trim(),
      });
      setForm(saved);
      await queryClient.invalidateQueries({ queryKey: ['hero-banner'] });
      toastSuccess('Баннер сакталды');
    } catch (err) {
      toastError(getErrorMessage(err, 'Баннер сакталган жок'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="admin-placeholder-subtitle">Жүктөлүүдө...</p>;
  }

  return (
    <form className="qa-admin-form ui-card" onSubmit={onSubmit}>
      <div className="qa-admin-field">
        <label className="qa-admin-label" htmlFor="hero-title">Башкы текст</label>
        <input
          id="hero-title"
          className="qa-admin-input"
          value={form.title}
          onChange={(event) => setField('title', event.target.value)}
          required
        />
      </div>
      <div className="qa-admin-field">
        <label className="qa-admin-label" htmlFor="hero-subtitle">Кошумча текст</label>
        <textarea
          id="hero-subtitle"
          className="qa-admin-textarea"
          rows={3}
          value={form.subtitle}
          onChange={(event) => setField('subtitle', event.target.value)}
          required
        />
      </div>
      <div className="qa-admin-field">
        <label className="qa-admin-label" htmlFor="hero-name">Аты</label>
        <input
          id="hero-name"
          className="qa-admin-input"
          value={form.name}
          onChange={(event) => setField('name', event.target.value)}
          required
        />
      </div>
      <div className="qa-admin-field">
        <label className="qa-admin-label" htmlFor="hero-sky">Булут сүрөтү (URL)</label>
        <input
          id="hero-sky"
          className="qa-admin-input"
          value={form.skyImageUrl}
          onChange={(event) => setField('skyImageUrl', event.target.value)}
          required
        />
        {form.skyImageUrl ? (
          <img src={form.skyImageUrl} alt="" className="admin-hero-preview" />
        ) : null}
      </div>
      <div className="qa-admin-field">
        <label className="qa-admin-label" htmlFor="hero-banner">Баннер сүрөтү (URL)</label>
        <input
          id="hero-banner"
          className="qa-admin-input"
          value={form.bannerImageUrl}
          onChange={(event) => setField('bannerImageUrl', event.target.value)}
          required
        />
        {form.bannerImageUrl ? (
          <img src={form.bannerImageUrl} alt="" className="admin-hero-preview" />
        ) : null}
      </div>
      <div className="qa-admin-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Сакталууда...' : 'Сактоо'}
        </button>
      </div>
    </form>
  );
}
