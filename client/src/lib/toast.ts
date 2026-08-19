import { toast, type ToastOptions } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 4500,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
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
