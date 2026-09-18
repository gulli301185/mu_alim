import './load-env.js';
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
import { adminUsersRouter } from './routes/admin-users.js';
import { coursesRouter } from './routes/courses.js';
import { testsRouter } from './routes/tests.js';
import { reviewsRouter } from './routes/reviews.js';
import { heroRouter } from './routes/hero.js';
import { siteImagesRouter } from './routes/site-images.js';
import { enrollmentsRouter } from './routes/enrollments.js';
import { progressRouter } from './routes/progress.js';
import { teacherQuestionsRouter } from './routes/teacher-questions.js';
import { isMailConfigured } from './lib/mail.js';
import { isSmsConfigured } from './lib/sms.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
const openapiPath = resolve(dirname(fileURLToPath(import.meta.url)), 'openapi.json');
const openapiDocument = JSON.parse(readFileSync(openapiPath, 'utf8'));
const uploadsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../uploads');

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, {
  customSiteTitle: 'Mu Alim API — Swagger',
}));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api', enrollmentsRouter);
app.use('/api', progressRouter);
app.use('/api/qa', qaRouter);
app.use('/api/prayer', prayerRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api', heroRouter);
app.use('/api', siteImagesRouter);
app.use('/api', teacherQuestionsRouter);
app.use('/api', reviewsRouter);
app.use('/api', testsRouter);
/** Course lesson CRUD before `/courses/:ref` style catch-alls in other routers. */
app.use('/api', lessonsRouter);
app.use('/api', coursesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Сервер катасы' });
});

app.listen(port, () => {
  console.log(`API server: http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
  console.log(`Reset codes: SMS ${isSmsConfigured() ? 'on' : 'off'}, email ${isMailConfigured() ? 'on' : 'off'}`);
});
