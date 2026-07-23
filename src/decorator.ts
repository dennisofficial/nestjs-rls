import 'reflect-metadata';
import type { RlsPolicy } from './types';

export const RLS_POLICY = Symbol.for('nestjs-rls:policy');
export const RLS_EXEMPT = Symbol.for('nestjs-rls:exempt');
export const EXPOSED = Symbol.for('nestjs-rls:exposed');

/**
 * Attach a row-level-security policy to a TypeORM entity. The policy is read back by
 * `db.scoped(Entity)` (query path) and by the `./pg-realtime` bridge (realtime path).
 *
 *   @Entity({ name: 'jobs' })
 *   @Rls<Job, AppClaims>((c) => ({ orgId: { $in: c.orgIds } }))
 *   export class Job { ... }
 */
export function Rls<T = unknown, Claims = unknown>(policy: RlsPolicy<Claims, T>): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(RLS_POLICY, policy, target);
  };
}

/**
 * Mark an entity as exempt from RLS (allow-all). Use for identity/lookup tables that must not
 * be scoped — and, critically, for any table your claims resolver itself reads, to avoid
 * recursion. Exempt wins over any `@Rls`/`static rls`.
 */
export function RlsExempt(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(RLS_EXEMPT, true, target);
  };
}

/**
 * Marks a property as allowed to leave the server (e.g. serialized onto an API response or a
 * realtime wire payload). Secure by default: a column left undecorated is never exposed by
 * consumers that read this metadata via `getExposed`. Optionally rename the field on the way
 * out (e.g. `@Expose('postedAt')` on a `createdAt` property).
 *
 * Composes with `@Rls`: `@Rls` decides *which rows* a caller can see, `@Expose` decides *which
 * columns* of those rows are ever serialized.
 */
export function Expose(alias?: string): PropertyDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const own = (Reflect.getOwnMetadata(EXPOSED, ctor) as Map<string, string> | undefined)
      ?? new Map<string, string>();
    own.set(propertyKey.toString(), alias ?? propertyKey.toString());
    Reflect.defineMetadata(EXPOSED, own, ctor);
  };
}
