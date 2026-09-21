import nodemailer from 'nodemailer';

function smtpUser() {
  return process.env.SMTP_USER?.trim() || '';
}

function smtpPass() {
  return (process.env.SMTP_PASS ?? '').replace(/\s+/g, '').trim();
}

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && smtpUser() && smtpPass());
}

function createTransport() {
  const user = smtpUser();
  const pass = smtpPass();
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const isGmail = host.includes('gmail.com') || user.endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 20_000,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
  });
}

export async function sendAuthCode(to: string, code: string, kind: 'reset' | 'register' = 'reset') {
  if (!isMailConfigured()) {
    const error = new Error('SMTP_NOT_CONFIGURED');
    error.name = 'SmtpNotConfiguredError';
    throw error;
  }

  const fromUser = smtpUser();
  const from = process.env.SMTP_FROM?.trim() || `Mu Alim <${fromUser}>`;
  const transporter = createTransport();
  const register = kind === 'register';
  const subject = register
    ? `Mu Alim каттоо коду: ${code}`
    : `Mu Alim сыр сөз коду: ${code}`;
  const purpose = register
    ? 'Каттоону ырастоо үчүн код:'
    : 'Сыр сөзүңүздү калыбына келтирүү үчүн код:';

  const info = await transporter.sendMail({
    from,
    to,
    replyTo: fromUser,
    envelope: { from: fromUser, to },
    subject,
    text: [
      'Assalamu aleykum!',
      '',
      purpose,
      code,
      '',
      'Kod 15 mungotko cheyin jarakttu.',
      'Eger siz bul suramdy jasabagan bolsonuz, kattı etibarga albanyz.',
      '',
      'Mu Alim',
    ].join('\n'),
    html: `
      <p>Ассаламу алейкум!</p>
      <p>${purpose}</p>
      <p style="font-size:28px;letter-spacing:0.28em;font-weight:700">${code}</p>
      <p>Код 15 мүнөткө чейин жарактуу. Эгер сиз бул сурамды жасабаган болсоңуз, катты этибарга албаңыз.</p>
      <p>Mu Alim</p>
    `,
  });

  const rejected = [...(info.rejected ?? []), ...(info.pending ?? [])];
  if (rejected.length > 0) {
    throw new Error(`SMTP_REJECTED ${rejected.join(',')}`);
  }

  console.log('[auth-code] mail sent', {
    to,
    kind,
    messageId: info.messageId,
    accepted: info.accepted,
    response: info.response,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[auth-code] DEV code for ${to}: ${code}`);
  }
}

export async function sendPasswordResetCode(to: string, code: string) {
  await sendAuthCode(to, code, 'reset');
}
