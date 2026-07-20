import type { MingoFilter, RlsAction, RlsDecision, RlsPolicy } from './types';

/**
 * Combine several mingo filters with `$and`, dropping empty ones.
 *  - 0 effective filters -> {} (match everything the policy allows)
 *  - 1 effective filter   -> that filter (no needless $and wrapper)
 *  - n                    -> { $and: [...] }
 */
export function mingoAnd(...filters: Array<MingoFilter | undefined | null>): MingoFilter {
  const real = filters.filter(
    (f): f is MingoFilter => !!f && typeof f === 'object' && Object.keys(f).length > 0,
  );
  if (real.length === 0) return {};
  if (real.length === 1) return real[0];
  return { $and: real };
}

export interface PolicyResult {
  allowed: boolean;
  /** The mingo scope to AND into the effective query. `{}` when the policy allows all. */
  scope: MingoFilter;
}

/**
 * Evaluate a policy for resolved claims and an action.
 *  - no policy (exempt/undecorated) -> allow all (scope {})
 *  - decision `false`               -> deny
 *  - decision `true`                -> allow all
 *  - decision MingoFilter           -> allow, scoped
 *
 * Object policies fall back to `read` for create/update/delete when the method is absent.
 */
export async function applyPolicy<Claims = unknown, T = unknown>(
  policy: RlsPolicy<Claims, T> | undefined,
  claims: Claims,
  action: RlsAction = 'read',
  candidate?: T,
): Promise<PolicyResult> {
  if (!policy) return { allowed: true, scope: {} };

  let decision: RlsDecision;
  if (typeof policy === 'function') {
    decision = policy(claims, action, candidate);
  } else {
    const fn =
      action === 'create'
        ? policy.create ?? policy.read
        : action === 'update'
          ? policy.update ?? policy.read
          : action === 'delete'
            ? policy.delete ?? policy.read
            : policy.read;
    decision = fn.call(policy, claims, candidate as T);
  }

  const result = await decision;
  if (result === false) return { allowed: false, scope: {} };
  if (result === true) return { allowed: true, scope: {} };
  return { allowed: true, scope: result };
}
