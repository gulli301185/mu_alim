import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import { currentLang, type Lang } from "../common/i18n";

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

@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");

  isConfigured() {
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

    const info = await transporter.sendMail({
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

    const rejected = [...(info.rejected ?? []), ...(info.pending ?? [])];
    if (rejected.length > 0) {
      throw new Error(`SMTP_REJECTED ${rejected.join(",")}`);
    }

    this.logger.log(
      `[auth-code] mail sent ${JSON.stringify({
        to,
        kind,
        messageId: info.messageId,
        accepted: info.accepted,
        response: info.response,
      })}`,
    );

    if (process.env.NODE_ENV !== "production") {
      this.logger.debug(`[auth-code] DEV code for ${to}: ${code}`);
    }
  }
}
