import { Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';

const SCHEMA_FILE = resolve(__dirname, '../../db/schema.sql');

/**
 * Creates the tables from `db/schema.sql` when the database is empty (no `users` table).
 * An already-initialised database is never touched.
 */
export async function ensureSchema(ds: DataSource) {
  const logger = new Logger('Database');
  const [{ exists }] = await ds.query(`SELECT to_regclass('public.users') IS NOT NULL AS exists`);
  if (exists) return;

  if (!existsSync(SCHEMA_FILE)) {
    logger.error(`Database is empty and ${SCHEMA_FILE} was not found — tables were not created`);
    return;
  }

  logger.warn('Database is empty — creating the schema from db/schema.sql');
  // pg_dump clears search_path for the session; keep it so unqualified table names still resolve.
  const sql = readFileSync(SCHEMA_FILE, 'utf8').replace(
    /SELECT pg_catalog\.set_config\('search_path', '', false\);/g,
    '',
  );

  const runner = ds.createQueryRunner();
  try {
    await runner.startTransaction();
    await runner.query(sql);
    await runner.commitTransaction();
    logger.log('Schema created. Load your data (see README/seed scripts) — tables are empty.');
  } catch (err) {
    await runner.rollbackTransaction();
    throw err;
  } finally {
    await runner.release();
  }
}
