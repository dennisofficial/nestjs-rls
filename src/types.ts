/** A mingo query object — a flat predicate over an entity's own columns. */
export type MingoFilter = Record<string, unknown>;

export type RlsAction = 'read' | 'create' | 'update' | 'delete';

/**
 * A policy's answer for one (claims, action):
 *   - a `MingoFilter` → allow, scoped to rows matching it
 *   - `true`          → allow all rows
 *   - `false`         → deny outright
 */
export type RlsDecision = MingoFilter | boolean | Promise<MingoFilter | boolean>;

/**
 * Object form: one method per action. `create`/`update`/`delete` fall back to `read`
 * when omitted (you can mutate what you can read, unless a method tightens it).
 */
export interface RlsPolicyObject<Claims = unknown, T = unknown> {
  read(claims: Claims): RlsDecision;
  create?(claims: Claims, candidate?: T): RlsDecision;
  update?(claims: Claims): RlsDecision;
  delete?(claims: Claims): RlsDecision;
}

/** Function form: `(claims, action) => decision`. Concise for member-read/owner-write splits. */
export type RlsPolicyFn<Claims = unknown, T = unknown> = (
  claims: Claims,
  action: RlsAction,
  candidate?: T,
) => RlsDecision;

/**
 * Declared AT the entity via `@Rls(...)`. Relationships must be pre-resolved to concrete
 * values in the body (e.g. `{ orgId: { $in: claims.orgIds } }`) so the returned predicate is
 * a flat condition over the entity's OWN columns — usable both as a TypeORM `WHERE` and an
 * in-memory mingo test.
 */
export type RlsPolicy<Claims = unknown, T = unknown> =
  | RlsPolicyObject<Claims, T>
  | RlsPolicyFn<Claims, T>;

/** Query-path seam: resolve the current claims (typically from request-scoped context). */
export type ResolveContext<Claims = unknown> = () => Claims | Promise<Claims>;

/** Realtime-path seam: resolve claims from a principal handed in at subscribe time. */
export type ResolveClaims<Principal = unknown, Claims = unknown> = (
  principal: Principal | null,
) => Claims | Promise<Claims>;

/** What the app provides to `RlsModule.forRootAsync`. */
export interface RlsContextConfig<Principal = unknown, Claims = unknown> {
  /** Query path — the app reads its request context (e.g. CLS) and returns claims. */
  resolveContext: ResolveContext<Claims>;
  /** Realtime path — principal → claims (no request context exists at subscribe time). */
  resolveClaims: ResolveClaims<Principal, Claims>;
  /** Optional global bypass (e.g. a system/cron context that should see everything). */
  exempt?: () => boolean;
}
