import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { assetUrl } from '../../lib/asset-url';
import {
  DEFAULT_SITE_IMAGES,
  fetchSiteImages,
  updateSiteImages,
  USTAZ_SITE_IMAGE_KEYS,
  USTAZ_SITE_IMAGE_LABELS,
  type SiteImageKey,
} from '../../lib/site-images-api';
import { getErrorMessage, toastError, toastSuccess } from '../../lib/toast';

function pickUstazImages(images: Record<string, string>) {
  const picked: Partial<Record<SiteImageKey, string>> = {};
  for (const key of USTAZ_SITE_IMAGE_KEYS) {
    picked[key] = images[key] ?? DEFAULT_SITE_IMAGES[key];
  }
  return picked as Record<(typeof USTAZ_SITE_IMAGE_KEYS)[number], string>;
}

export function AdminUstazImagesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => pickUstazImages(DEFAULT_SITE_IMAGES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchSiteImages()
      .then((images) => setForm(pickUstazImages(images)))
      .catch((err) => toastError(getErrorMessage(err, 'Сүрөттөр жүктөлгөн жок')))
      .finally(() => setLoading(false));
  }, []);

  const setField = (key: (typeof USTAZ_SITE_IMAGE_KEYS)[number], value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        USTAZ_SITE_IMAGE_KEYS.map((key) => [key, form[key].trim()]),
      );
      const saved = await updateSiteImages(token, payload);
      setForm(pickUstazImages(saved));
      await queryClient.invalidateQueries({ queryKey: ['site-images'] });
      toastSuccess('Устаз сүрөттөрү сакталды');
    } catch (err) {
      toastError(getErrorMessage(err, 'Сүрөттөр сакталган жок'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="admin-placeholder-subtitle">Жүктөлүүдө...</p>;
  }

  return (
    <form className="qa-admin-form ui-card" onSubmit={(e) => void onSubmit(e)}>
      <p className="admin-placeholder-subtitle mb-4">
        Башкы беттеги устаз блогу, /ustaz баннери жана суроо формасынын сүрөттөрү backend аркылуу
        жүктөлөт. URL — `/uploads/...` же толук шилтеме.
      </p>

      {USTAZ_SITE_IMAGE_KEYS.map((key) => {
        const url = form[key];
        const preview = assetUrl(url);
        return (
          <div key={key} className="qa-admin-field">
            <label className="qa-admin-label" htmlFor={`ustaz-img-${key}`}>
              {USTAZ_SITE_IMAGE_LABELS[key]}
            </label>
            <input
              id={`ustaz-img-${key}`}
              className="qa-admin-input"
              value={url}
              onChange={(event) => setField(key, event.target.value)}
              placeholder={DEFAULT_SITE_IMAGES[key]}
              required
            />
            {preview ? (
              <img src={preview} alt="" className="admin-hero-preview" loading="lazy" />
            ) : null}
          </div>
        );
      })}

      <div className="qa-admin-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Сакталууда...' : 'Сактоо'}
        </button>
      </div>
    </form>
  );
}
