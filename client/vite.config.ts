import { createLogger, defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DEFAULT_DEV_API = 'http://localhost:3001';

// This file is type-checked by tsconfig.node.json (lib ES2023, no Node/DOM types), so it must not use
// globals such as URL, console or process: env comes from loadEnv, messages from Vite's logger.
const logger = createLogger();

/** http(s)://localhost | 127.0.0.1 | [::1], optional port, optional trailing slash — nothing else
 * (no credentials, path, query or look-alike hosts such as localhost.example.com). */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?\/?$/;

function isLocalOrigin(value: string) {
  return LOCAL_ORIGIN.test(value);
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
    logger.warn(
      `[vite] VITE_API_URL is not local, so relative /api and /uploads are proxied to ${DEFAULT_DEV_API}, not to it.`,
    );
  }
  return DEFAULT_DEV_API;
}

/** Proxy for `vite` (dev server) only — local API targets, as before. */
function devProxy(mode: string) {
  // Prefix '' = every variable: the .env files of this mode plus the shell environment (which wins).
  const target = devProxyTarget(loadEnv(mode, '.', ''));
  logger.info(`[vite] /api and /uploads proxy → ${target}`);
  return {
    '/api': { target, changeOrigin: true },
    '/uploads': { target, changeOrigin: true },
  };
}

// Keep ONE top-level `return` with a literal `plugins: [...]` array: Cloudflare's `wrangler deploy`
// autoconfig appends cloudflare() to exactly that array (a shorthand or variable makes it fail).
export default defineConfig(({ command, mode, isPreview }) => {
  const devServer = command === 'serve' && !isPreview;
  return {
    plugins: [react(), tailwindcss()],
    // `vite build` (Cloudflare) and `vite preview`: no proxy; `vite` (dev): local-only proxy.
    server: devServer ? { proxy: devProxy(mode) } : undefined,
    preview: { proxy: {} },
  };
});
