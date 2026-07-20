import {
  type MingoFilter as PgMingoFilter,
  RealtimeRuleGuard,
  type Row,
} from '@workspace/pg-realtime';
import type { EntityTarget } from 'typeorm';
import { getRlsPolicy } from '../metadata';
import { applyPolicy } from '../policy';
import type { ResolveClaims, RlsAction } from '../types';

/**
 * A pg-realtime guard synthesized from an entity's `@Rls` policy. The realtime engine has no
 * request context, so it resolves claims from the principal handed in at subscribe time.
 */
class RlsRealtimeGuard<Principal, Claims> extends RealtimeRuleGuard<Principal, Row> {
  constructor(
    private readonly entity: Function,
    private readonly resolveClaims: ResolveClaims<Principal, Claims>,
  ) {
    super();
  }

  canRead(user: Principal | null) {
    return this.decide('read', user);
  }
  canCreate(user: Principal | null) {
    return this.decide('create', user);
  }
  canUpdate(user: Principal | null) {
    return this.decide('update', user);
  }
  canDelete(user: Principal | null) {
    return this.decide('delete', user);
  }

  private async decide(
    action: RlsAction,
    user: Principal | null,
  ): Promise<PgMingoFilter | boolean> {
    const policy = getRlsPolicy<Claims>(this.entity);
    if (!policy) return true; // exempt / undecorated → allow all rows of this model
    const claims = await this.resolveClaims(user);
    const { allowed, scope } = await applyPolicy(policy, claims, action);
    return allowed ? (scope as PgMingoFilter) : false;
  }
}

/**
 * Build a pg-realtime `RealtimeRuleGuard` from an `@Rls`-decorated entity, for use as a
 * `ModelConfig.guard`. `resolveClaims` maps the subscribe-time principal to claims.
 */
export function rlsGuard<Principal = unknown, Claims = unknown>(
  entity: EntityTarget<any>,
  resolveClaims: ResolveClaims<Principal, Claims>,
): RealtimeRuleGuard<Principal, Row> {
  return new RlsRealtimeGuard(entity as Function, resolveClaims);
}
