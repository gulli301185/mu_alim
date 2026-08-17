import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './routes/auth.js';
import { qaRouter } from './routes/qa.js';
import { prayerRouter } from './routes/prayer.js';
import { lessonsRouter } from './routes/lessons.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;
const openapiPath = resolve(dirname(fileURLToPath(import.meta.url)), 'openapi.json');
const openapiDocument = JSON.parse(readFileSync(openapiPath, 'utf8'));

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, {
  customSiteTitle: 'Mu Alim API — Swagger',
}));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/qa', qaRouter);
app.use('/api/prayer', prayerRouter);
app.use('/api', lessonsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Сервер катасы' });
});

app.listen(port, () => {
  console.log(`API server: http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});
