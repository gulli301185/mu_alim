import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { MailService } from './mail/mail.service';
import { SmsService } from './mail/sms.service';

async function bootstrap() {
  // Body parsing is wired by hand: the review-video upload streams its raw body itself.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const port = Number(process.env.PORT) || 3001;
  const openapiDocument = JSON.parse(readFileSync(resolve(__dirname, 'openapi.json'), 'utf8'));

  app.enableCors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' });
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

  await app.listen(port);

  console.log(`API server: http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
  console.log(
    `Reset codes: SMS ${app.get(SmsService).isConfigured() ? 'on' : 'off'}, email ${app.get(MailService).isConfigured() ? 'on' : 'off'}`,
  );
}

void bootstrap();
