import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { currentLang, type Lang } from "../common/i18n";
import { resolveMailTransport } from "./mail-transport";

/** Auth-code email text per site language (see common/i18n.ts). */
const AUTH_CODE_COPY: Record<
  Lang,
  {
    registerSubject: string;
    resetSubject: string;
    registerPurpose: string;
    resetPurpose: string;
    greeting: string;
    validity: string;
    plainValidity: string;
    plainIgnore: string;
  }
> = {
  kg: {
    registerSubject: "Mu Alim каттоо коду",
    resetSubject: "Mu Alim сыр сөз коду",
    registerPurpose: "Каттоону ырастоо үчүн код:",
    resetPurpose: "Сыр сөзүңүздү калыбына келтирүү үчүн код:",
    greeting: "Ассаламу алейкум!",
    validity:
      "Код 15 мүнөткө чейин жарактуу. Эгер сиз бул сурамды жасабаган болсоңуз, катты этибарга албаңыз.",
    plainValidity: "Kod 15 mungotko cheyin jarakttu.",
    plainIgnore: "Eger siz bul suramdy jasabagan bolsonuz, kattı etibarga albanyz.",
  },
  ru: {
    registerSubject: "Mu Alim: код регистрации",
    resetSubject: "Mu Alim: код для сброса пароля",
    registerPurpose: "Код для подтверждения регистрации:",
    resetPurpose: "Код для восстановления пароля:",
    greeting: "Ассаламу алейкум!",
    validity:
      "Код действителен 15 минут. Если вы не отправляли этот запрос, просто проигнорируйте письмо.",
    plainValidity: "Код действителен 15 минут.",
    plainIgnore: "Если вы не отправляли этот запрос, просто проигнорируйте письмо.",
  },
};

function smtpUser() {
  return process.env.SMTP_USER?.trim() || "";
}

function smtpPass() {
  return (process.env.SMTP_PASS ?? "").replace(/\s+/g, "").trim();
}

type SmtpStage = "connect" | "auth" | "send";

/** Leading 3-digit SMTP reply code of a server response ("250 2.0.0 OK …" → 250), or undefined. */
function smtpReplyCode(response: unknown): number | undefined {
  const match = /^\s*([2-5]\d{2})\b/.exec(typeof response === "string" ? response : "");
  return match ? Number(match[1]) : undefined;
}

/** Message-ID without the brackets and the "@domain" part — the random id is enough to find
 * the message in provider logs and carries no address. */
function messageIdToken(messageId: unknown): string | undefined {
  if (typeof messageId !== "string") return undefined;
  const local = messageId.replace(/^<|>$/g, "").split("@")[0];
  return /^[A-Za-z0-9._-]{1,128}$/.test(local) ? local : undefined;
}

/**
 * Diagnostics that are safe to log for an SMTP failure. err.message / err.response are left out
 * on purpose: they can quote addresses, the login name or the server's full reply.
 */
function smtpFailureDetails(err: unknown) {
  const e = (err ?? {}) as { code?: unknown; command?: unknown; responseCode?: unknown };
  const code = typeof e.code === "string" && /^[A-Z][A-Z0-9_]{1,31}$/.test(e.code) ? e.code : undefined;
  const command =
    typeof e.command === "string" && /^[A-Z]{2,10}( [A-Z]{2,10})?$/.test(e.command) ? e.command : undefined;
  const responseCode =
    typeof e.responseCode === "number" && e.responseCode >= 100 && e.responseCode <= 599 ? e.responseCode : undefined;
  let stage: SmtpStage = "send";
  if (code === "EAUTH" || command?.startsWith("AUTH")) stage = "auth";
  else if (
    ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ECONNRESET", "ETLS", "EGREETING"].includes(code ?? "") ||
    command === "CONN" ||
    command === "GREETING"
  ) {
    stage = "connect";
  }
  return { stage, code, command, responseCode };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");

  isConfigured() {
    try {
      if (resolveMailTransport() === "log") return true;
    } catch {
      return false;
    }
    return Boolean(process.env.SMTP_HOST?.trim() && smtpUser() && smtpPass());
  }

  private createTransport() {
    const user = smtpUser();
    const pass = smtpPass();
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const isGmail = host.includes("gmail.com") || user.endsWith("@gmail.com");

    if (isGmail) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
        connectionTimeout: 20_000,
        greetingTimeout: 20_000,
        socketTimeout: 20_000,
      });
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 20_000,
    });
  }

  async sendAuthCode(
    to: string,
    code: string,
    kind: "reset" | "register" = "reset",
  ) {
    // MAIL_TRANSPORT=log (never in production): nothing is emailed. The log only records that a
    // code was withheld — never the code or the address.
    if (resolveMailTransport() === "log") {
      this.logger.warn(`[auth-code] MAIL_TRANSPORT=log — ${kind} code not emailed (code and address are not logged)`);
      return;
    }

    if (!this.isConfigured()) {
      const error = new Error("SMTP_NOT_CONFIGURED");
      error.name = "SmtpNotConfiguredError";
      throw error;
    }

    const fromUser = smtpUser();
    const from = process.env.SMTP_FROM?.trim() || `Mu Alim <${fromUser}>`;
    const transporter = this.createTransport();
    const register = kind === "register";
    const copy = AUTH_CODE_COPY[currentLang()];
    const subject = `${register ? copy.registerSubject : copy.resetSubject}: ${code}`;
    const purpose = register ? copy.registerPurpose : copy.resetPurpose;

    let info: SMTPTransport.SentMessageInfo;
    try {
      info = await transporter.sendMail({
      from,
      to,
      replyTo: fromUser,
      envelope: { from: fromUser, to },
      subject,
      text: [
        "Assalamu aleykum!",
        "",
        purpose,
        code,
        "",
        copy.plainValidity,
        copy.plainIgnore,
        "",
        "Mu Alim",
      ].join("\n"),
      html: `
      <p>${copy.greeting}</p>
      <p>${purpose}</p>
      <p style="font-size:28px;letter-spacing:0.28em;font-weight:700">${code}</p>
      <p>${copy.validity}</p>
      <p>Mu Alim</p>
    `,
      });
    } catch (err) {
      // Safe fields only; the error itself is re-thrown unchanged for the caller.
      this.logger.error(`[auth-code] mail failed ${JSON.stringify({ kind, ...smtpFailureDetails(err) })}`);
      throw err;
    }

    const accepted = info.accepted?.length ?? 0;
    const rejected = (info.rejected?.length ?? 0) + (info.pending?.length ?? 0);
    const smtpCode = smtpReplyCode(info.response);
    if (rejected > 0) {
      this.logger.error(`[auth-code] mail rejected ${JSON.stringify({ kind, accepted, rejected, smtpCode })}`);
      throw new Error(`SMTP_REJECTED ${rejected} recipient(s)`);
    }

    this.logger.log(
      `[auth-code] mail sent ${JSON.stringify({ kind, accepted, rejected, smtpCode, messageId: messageIdToken(info.messageId) })}`,
    );
  }
}
