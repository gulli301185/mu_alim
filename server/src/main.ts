import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ensureSchema } from './database/bootstrap-schema';
import { MailService } from './mail/mail.service';
import { SmsService } from './mail/sms.service';

/** Sites allowed to call the API. `CLIENT_ORIGIN` adds more (comma-separated). */
function allowedOrigins() {
  const fromEnv = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return [
    ...new Set([
      'https://mualim.kg',
      'https://www.mualim.kg',
      'http://localhost:5173',
      ...fromEnv,
    ]),
  ];
}

async function bootstrap() {
  // Body parsing is wired by hand: the review-video upload streams its raw body itself.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const port = Number(process.env.PORT) || 3001;
  const openapiDocument = JSON.parse(readFileSync(resolve(__dirname, 'openapi.json'), 'utf8'));

  app.enableCors({ origin: allowedOrigins() });
  app.use(json());
  app.useStaticAssets(resolve(__dirname, '../uploads'), { prefix: '/uploads' });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument, { customSiteTitle: 'Mu Alim API — Swagger' }),
  );

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await ensureSchema(app.get(DataSource));
  await app.listen(port);

  console.log(`API server: http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
  console.log(
    `Reset codes: SMS ${app.get(SmsService).isConfigured() ? 'on' : 'off'}, email ${app.get(MailService).isConfigured() ? 'on' : 'off'}`,
  );
}

void bootstrap();
