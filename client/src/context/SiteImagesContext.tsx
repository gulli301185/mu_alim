import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assetCssUrl, assetUrl } from '../lib/asset-url';
import {
  DEFAULT_SITE_IMAGES,
  fetchSiteImages,
  SITE_IMAGE_KEYS,
  type SiteImageKey,
} from '../lib/site-images-api';

type SiteImagesContextValue = {
  images: Record<string, string>;
  loading: boolean;
  image: (key: SiteImageKey, fallback?: string) => string;
  cssUrl: (key: SiteImageKey, fallback?: string) => string;
};

const SiteImagesContext = createContext<SiteImagesContextValue | null>(null);

function applyCssVars(images: Record<string, string>) {
  const root = document.documentElement;
  root.style.setProperty('--site-img-oyu-hero', assetCssUrl(images[SITE_IMAGE_KEYS.reviewOyu]));
  root.style.setProperty('--site-img-tunduk-hero', assetCssUrl(images[SITE_IMAGE_KEYS.heroBanner]));
  root.style.setProperty('--site-img-uzor-corner', assetCssUrl(images[SITE_IMAGE_KEYS.decorUzorCorner]));
}

export function SiteImagesProvider({ children }: { children: ReactNode }) {
  const { data = DEFAULT_SITE_IMAGES, isLoading } = useQuery({
    queryKey: ['site-images'],
    queryFn: fetchSiteImages,
    placeholderData: DEFAULT_SITE_IMAGES,
    staleTime: 5 * 60_000,
    retry: 2,
  });

  useEffect(() => {
    applyCssVars(data);
  }, [data]);

  const value: SiteImagesContextValue = {
    images: data,
    loading: isLoading,
    image: (key, fallback) => assetUrl(data[key] ?? fallback ?? DEFAULT_SITE_IMAGES[key]),
    cssUrl: (key, fallback) =>
      assetCssUrl(data[key] ?? fallback ?? DEFAULT_SITE_IMAGES[key]),
  };

  return <SiteImagesContext.Provider value={value}>{children}</SiteImagesContext.Provider>;
}

export function useSiteImages() {
  const ctx = useContext(SiteImagesContext);
  if (!ctx) {
    throw new Error('useSiteImages must be used within SiteImagesProvider');
  }
  return ctx;
}
