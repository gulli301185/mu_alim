import dotenv from 'dotenv';
import { resolve } from 'node:path';

/** Loads the repo-root `.env` (works from both `src/` and `dist/`). */
dotenv.config({ path: resolve(__dirname, '../../.env') });
