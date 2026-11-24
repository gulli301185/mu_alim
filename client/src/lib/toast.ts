import { toast, type ToastOptions } from 'react-toastify';
import i18n from '../i18n';
import { localizedText } from '../i18n/localizedList';

const defaultOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 4500,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

/**
 * User-facing text for an error. fetch() rejects with a TypeError when the server can't be
 * reached, so that becomes a plain "check your connection" message instead of the browser's
 * English text. Other messages are shown as they are, except that the Kyrgyz fallbacks thrown
 * by lib/*-api.ts are swapped for their ru.json "apiErrors" translation in the Russian UI
 * (server messages already arrive translated, see Accept-Language in i18n/index.ts).
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return i18n.t('errors.network');
  if (err instanceof Error && err.message) return localizedText(i18n, 'apiErrors', err.message);
  if (typeof err === 'string' && err.trim()) return localizedText(i18n, 'apiErrors', err);
  return fallback;
}

export function toastError(message: string, options?: ToastOptions) {
  toast.error(message, { ...defaultOptions, ...options });
}

export function toastSuccess(message: string, options?: ToastOptions) {
  toast.success(message, { ...defaultOptions, ...options });
}

export function toastInfo(message: string, options?: ToastOptions) {
  toast.info(message, { ...defaultOptions, ...options });
}
