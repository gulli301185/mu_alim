import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { phoneToSmsDigits } from '../lib/phone';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function nikitaStatus(body: string) {
  const match = body.match(/<status>\s*(\d+)\s*<\/status>/i);
  return match ? Number(match[1]) : null;
}

@Injectable()
export class SmsService {
  isConfigured() {
    const nikita = Boolean(process.env.SMS_LOGIN?.trim() && process.env.SMS_PASSWORD?.trim());
    const twilio = Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim() &&
        process.env.TWILIO_FROM?.trim(),
    );
    return nikita || twilio;
  }

  private async postNikita(to: string, text: string, sender: string) {
    const login = process.env.SMS_LOGIN!.trim();
    const password = process.env.SMS_PASSWORD!.trim();
    const id = randomBytes(6).toString('hex');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <login>${escapeXml(login)}</login>
  <pwd>${escapeXml(password)}</pwd>
  <id>${id}</id>
  <sender>${escapeXml(sender)}</sender>
  <text>${escapeXml(text)}</text>
  <phones><phone>${phoneToSmsDigits(to)}</phone></phones>
</message>`;

    const res = await fetch('https://smspro.nikita.kg/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body: xml,
    });

    const body = await res.text();
    const status = nikitaStatus(body);
    if (!res.ok || status === null || status !== 0) {
      const error = new Error(
        `NIKITA_SMS_FAILED http=${res.status} status=${status ?? 'none'} body=${body.slice(0, 300)}`,
      );
      (error as Error & { nikitaStatus?: number }).nikitaStatus = status ?? undefined;
      throw error;
    }
  }

  private async sendViaNikita(to: string, text: string) {
    const sender =
      (process.env.SMS_SENDER?.trim() || 'MuAlim').replace(/[^A-Za-z0-9.-]/g, '').slice(0, 11) || 'MuAlim';
    try {
      await this.postNikita(to, text, sender);
    } catch (err) {
      if ((err as { nikitaStatus?: number }).nikitaStatus === 5) {
        await this.postNikita(to, text, phoneToSmsDigits(to).slice(0, 14));
        return;
      }
      throw err;
    }
  }

  private async sendViaTwilio(to: string, text: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
    const token = process.env.TWILIO_AUTH_TOKEN!.trim();
    const from = process.env.TWILIO_FROM!.trim();
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from, Body: text });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!res.ok) {
      throw new Error(`TWILIO_SMS_FAILED ${res.status}`);
    }
  }

  async sendPasswordResetSms(to: string, code: string) {
    if (!this.isConfigured()) {
      const error = new Error('SMS_NOT_CONFIGURED');
      error.name = 'SmsNotConfiguredError';
      throw error;
    }

    const text = `Mu Alim kod: ${code}. 15 min.`;

    if (process.env.SMS_LOGIN?.trim() && process.env.SMS_PASSWORD?.trim()) {
      await this.sendViaNikita(to, text);
      return;
    }

    await this.sendViaTwilio(to, text);
  }
}
