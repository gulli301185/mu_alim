import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DEFAULT_DEV_API = 'http://localhost:3001';

/** True only for http(s)://localhost | 127.0.0.1 | [::1] with an optional port and no path. */
function isLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      (url.pathname === '' || url.pathname === '/') &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/**
 * Dev-server proxy for relative /api and /uploads requests — always to a LOCAL API:
 * DEV_API_PROXY_TARGET (must be local, otherwise the dev server refuses to start), else a local
 * VITE_API_URL (e.g. a QA test API), else the dev backend on :3001. A remote VITE_API_URL is the
 * app's own API setting and is never used as a proxy target.
 */
function devProxyTarget(env: Record<string, string | undefined>) {
  const explicit = env.DEV_API_PROXY_TARGET?.trim();
  if (explicit) {
    if (!isLocalOrigin(explicit)) {
      throw new Error(
        `DEV_API_PROXY_TARGET must be a local origin such as http://localhost:3001 (got a non-local value)`,
      );
    }
    return explicit;
  }
  const apiUrl = env.VITE_API_URL?.trim();
  if (apiUrl && isLocalOrigin(apiUrl)) return apiUrl;
  if (apiUrl) {
    console.warn(
      `[vite] VITE_API_URL is not local, so relative /api and /uploads are proxied to ${DEFAULT_DEV_API}, not to it.`,
    );
  }
  return DEFAULT_DEV_API;
}

export default defineConfig(({ command, mode, isPreview }) => {
  const plugins = [react(), tailwindcss()];

  // `vite build` (Cloudflare) never uses a proxy: nothing to resolve, nothing that could fail.
  // `vite preview` serves the production build and must not forward /api anywhere.
  if (command !== 'serve' || isPreview) {
    return { plugins, preview: { proxy: {} } };
  }

  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const target = devProxyTarget(env);
  console.info(`[vite] /api and /uploads proxy → ${target}`);
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/uploads': { target, changeOrigin: true },
  };
  return { plugins, server: { proxy }, preview: { proxy: {} } };
});
