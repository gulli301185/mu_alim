import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { qaRouter } from './routes/qa.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/qa', qaRouter);

app.listen(port, () => {
  console.log(`API server: http://localhost:${port}`);
});
