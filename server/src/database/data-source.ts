import dotenv from 'dotenv';
import { resolve } from 'node:path';
import {
  DataSource,
  type DeepPartial,
  type EntityTarget,
  type FindOptionsWhere,
  type ObjectLiteral,
} from 'typeorm';
import { ENTITIES } from './entities';

/** Standalone connection for the seed / import scripts (they run outside Nest). */
export async function connectScriptDb() {
  dotenv.config({ path: resolve(__dirname, '../../../.env') });
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    entities: ENTITIES,
    synchronize: false,
  });
  return ds.initialize();
}

/** Insert-or-update by natural key, for scripts. */
export async function upsertBy<T extends ObjectLiteral>(
  ds: DataSource,
  target: EntityTarget<T>,
  where: FindOptionsWhere<T>,
  update: Partial<T>,
  create: Partial<T>,
): Promise<T> {
  const repo = ds.getRepository(target);
  const existing = await repo.findOneBy(where);
  if (existing) return repo.save(Object.assign(existing, update)) as Promise<T>;
  const entity: T = repo.create(create as DeepPartial<T>);
  return repo.save(entity) as Promise<T>;
}
