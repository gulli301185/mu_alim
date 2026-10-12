export type MailTransport = 'smtp' | 'log';

/**
 * How auth codes are delivered. `smtp` (default) emails them; `log` writes them to the server
 * log instead, so local development and QA never send real mail. `log` is refused when
 * NODE_ENV=production — the API will not start with it (see main.ts).
 */
export function resolveMailTransport(env: NodeJS.ProcessEnv = process.env): MailTransport {
  const value = (env.MAIL_TRANSPORT ?? '').trim().toLowerCase();
  if (!value || value === 'smtp') return 'smtp';
  if (value !== 'log') throw new Error('MAIL_TRANSPORT must be "smtp" or "log"');
  if (env.NODE_ENV === 'production') throw new Error('MAIL_TRANSPORT=log is not allowed in production');
  return 'log';
}
