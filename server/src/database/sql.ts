import { Brackets, ILike, type SelectQueryBuilder, type ObjectLiteral } from 'typeorm';

/** Escapes `%`, `_` and `\` so user input can be embedded in a LIKE pattern. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Case-insensitive "contains" (`contains`, case-insensitive). */
export const containsInsensitive = (value: string) => ILike(`%${escapeLike(value)}%`);

/** Adds `LOWER(alias.column) = LOWER(:param)` (`equals`, case-insensitive). */
export function whereEqualsInsensitive<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  column: string,
  param: string,
  value: string,
) {
  return qb.andWhere(`LOWER(${column}) = LOWER(:${param})`, { [param]: value });
}

/** `(a ILIKE :p OR b ILIKE :p ...)` for a set of columns. */
export function anyContains(columns: string[], param: string, value: string) {
  return new Brackets((qb) => {
    for (const column of columns) {
      qb.orWhere(`${column} ILIKE :${param} ESCAPE '\\'`, { [param]: `%${escapeLike(value)}%` });
    }
  });
}
