import {
  And,
  Equal,
  FindOperator,
  type FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import type { MingoFilter } from '../types';

/**
 * Translate a mingo scope into a TypeORM `FindOptionsWhere`, so row-level security is
 * enforced at the DATABASE — never by discarding rows after the fetch (which wastes the
 * query and breaks pagination counts).
 *
 * Only the safe, unambiguous subset is translated; anything that could mistranslate (and
 * thus leak or hide rows) throws instead of guessing:
 *   - equality (incl. `null` -> IsNull)
 *   - $eq $ne $in $nin $gt $gte $lt $lte
 *   - top-level $and (merged) and $or (array of wheres)
 * Unsupported (throws): $regex, $not/$nor, JSON-path conditions, $or nested in $and, …
 */
const COMPARISON: Record<string, (v: any) => FindOperator<any>> = {
  $eq: (v) => (v === null ? IsNull() : Equal(v)),
  $ne: (v) => (v === null ? Not(IsNull()) : Not(v)),
  $in: (v) => In(asArray(v, '$in')),
  $nin: (v) => Not(In(asArray(v, '$nin'))),
  $gt: (v) => MoreThan(v),
  $gte: (v) => MoreThanOrEqual(v),
  $lt: (v) => LessThan(v),
  $lte: (v) => LessThanOrEqual(v),
};

export function toFindOptionsWhere<T = any>(
  filter: MingoFilter,
): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
  const keys = Object.keys(filter);

  // Top-level $or -> an array of wheres (TypeORM's OR form).
  if (keys.includes('$or')) {
    if (keys.length > 1) {
      throw unsupported(
        '$or alongside sibling keys at the top level — wrap the siblings in $and, or build the query manually',
      );
    }
    return (filter.$or as MingoFilter[]).flatMap((branch) => {
      const w = toFindOptionsWhere<T>(branch);
      return Array.isArray(w) ? w : [w];
    });
  }

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const val = (filter as Record<string, unknown>)[key];
    if (key === '$and') {
      for (const sub of val as MingoFilter[]) {
        const w = toFindOptionsWhere<T>(sub);
        if (Array.isArray(w)) {
          throw unsupported('$or nested under $and — not representable as a TypeORM where');
        }
        mergeAnd(out, w as Record<string, unknown>);
      }
    } else if (key.startsWith('$')) {
      throw unsupported(`top-level operator "${key}"`);
    } else {
      out[key] = translateCondition(val, key);
    }
  }
  return out as FindOptionsWhere<T>;
}

/**
 * AND a resolved RLS scope-where into a caller's where. Distinct fields is the norm; on a
 * field present in both, the two conditions are composed with `And()` so a caller filter can
 * never WIDEN the scope. `$or` on either side is distributed (cross product).
 */
export function mergeScopedWhere<T = any>(
  scope: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  caller?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
  if (caller === undefined) return scope;
  const scopes = Array.isArray(scope) ? scope : [scope];
  const callers = Array.isArray(caller) ? caller : [caller];
  const merged = scopes.flatMap((s) =>
    callers.map((c) => andMergeWhere(s as Record<string, unknown>, c as Record<string, unknown>)),
  );
  return (merged.length === 1 ? merged[0] : merged) as
    | FindOptionsWhere<T>
    | FindOptionsWhere<T>[];
}

// ─── internals ───────────────────────────────────────────────────────────────

function andMergeWhere(
  scope: Record<string, unknown>,
  caller: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...scope };
  for (const [k, v] of Object.entries(caller)) {
    out[k] = k in out ? And(asOperator(out[k]), asOperator(v)) : v;
  }
  return out;
}

function translateCondition(cond: unknown, field: string): unknown {
  if (cond === null) return IsNull();
  if (isScalar(cond)) return cond; // implicit equality
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    const entries = Object.entries(cond as Record<string, unknown>);
    if (entries.length === 0) throw unsupported(`empty condition for field "${field}"`);
    if (!entries.every(([op]) => op.startsWith('$'))) {
      throw unsupported(`nested-object / JSON-path condition for field "${field}"`);
    }
    const ops = entries.map(([op, v]) => {
      const fn = COMPARISON[op];
      if (!fn) {
        throw unsupported(
          `operator "${op}" on field "${field}" — keep RLS scopes to equality/$in/$nin/comparisons, or build the query manually`,
        );
      }
      return fn(v);
    });
    return ops.length === 1 ? ops[0] : And(...ops);
  }
  throw unsupported(`value ${JSON.stringify(cond)} for field "${field}"`);
}

function mergeAnd(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(source)) {
    target[k] = k in target ? And(asOperator(target[k]), asOperator(v)) : v;
  }
}

function asOperator(v: unknown): FindOperator<any> {
  return v instanceof FindOperator ? v : Equal(v as any);
}

function isScalar(v: unknown): boolean {
  return (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    typeof v === 'bigint' ||
    v instanceof Date
  );
}

function asArray(v: unknown, op: string): unknown[] {
  if (!Array.isArray(v)) throw unsupported(`${op} expects an array`);
  return v;
}

function unsupported(msg: string): Error {
  return new Error(`@workspace/nestjs-rls/typeorm: cannot translate ${msg}`);
}
