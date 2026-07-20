import 'reflect-metadata';
import type { RlsPolicy } from './types';

export const RLS_POLICY = Symbol.for('nestjs-rls:policy');
export const RLS_EXEMPT = Symbol.for('nestjs-rls:exempt');

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
