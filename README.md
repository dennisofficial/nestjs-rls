# @workspace/nestjs-rls

Entity-level Row-Level Security for **NestJS + TypeORM + Postgres**.

Declare the access rule once, on the entity:

```ts
@Entity({ name: 'jobs' })
@Rls<Job, AppClaims>((c) => ({ orgId: { $in: c.orgIds } }))
export class Job {
  /* ... */
}
```

Then read it from any module with the scope applied automatically:

```ts
await db.scoped(Job).find({ where: { status: 'OPEN' } }); // AND-ed with the entity's @Rls scope
```

## Column exposure

`@Rls` decides *which rows* a caller can see; `@Expose` decides *which columns* of those rows
are ever serialized back out. It's a secure-by-default allowlist — an entity property left
undecorated is never exposed by anything reading this metadata, regardless of what's on the
column:

```ts
@Entity({ name: 'jobs' })
@Rls<Job, AppClaims>((c) => ({ orgId: { $in: c.orgIds } }))
export class Job {
  @Expose()
  id!: string;

  @Expose('postedAt')
  createdAt!: Date;

  internalNotes!: string; // never exposed
}
```

```ts
getExposed(Job); // Map { 'id' => 'id', 'createdAt' => 'postedAt' }
```

`@Expose(alias?)` optionally renames the field on the way out (e.g. `createdAt` → `postedAt`).
`getExposed` walks the prototype chain, so exposures declared on a base class are inherited —
subclass exposures win on a name collision.

`@Expose`/`getExposed` is also the `resolveExposed` plug `@workspace/pg-realtime`'s
`RealtimeNestModule` expects — see that package's [NestJS integration](../pg-realtime/README.md#nestjs-integration-nest-realtime)
section for the full wiring.

## Design

- **Generic.** The package knows nothing about your identity model. You supply one
  `resolveContext()` (query path) and `resolveClaims(principal)` (realtime path) via
  `RlsModule.forRootAsync`. Claims can be any shape.
- **CLS-free.** The package never imports `nestjs-cls`. Read your request context inside
  your resolver; the package only calls the callback.
- **Scopes are mingo predicates** — flat conditions over the entity's own columns. The same
  scope works as a TypeORM `WHERE` (query path) and an in-memory predicate (realtime path).

## Subpaths

- `.` — `@Rls`, `@RlsExempt`, `getRlsPolicy`, `@Expose`, `getExposed`, `applyPolicy`, types.
- `./nest` — `RlsModule`, `Db` (`db.scoped(Entity)`), `ScopedRepository`, `RlsForbiddenError`.
- `./typeorm` — `toFindOptionsWhere` (mingo → TypeORM `FindOptionsWhere`).
- `./pg-realtime` — `rlsGuard(entity, resolveClaims)` bridge (optional peer `@workspace/pg-realtime`).
