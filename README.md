# @workspace/nestjs-rls

Entity-level Row-Level Security for **NestJS + TypeORM + Postgres**.

Declare the access rule once, on the entity:

```ts
@Entity({ name: 'jobs' })
@Rls<Job, AppClaims>((c) => ({ orgId: { $in: c.orgIds } }))
export class Job { /* ... */ }
```

Then read it from any module with the scope applied automatically:

```ts
await db.scoped(Job).find({ where: { status: 'OPEN' } }); // AND-ed with the entity's @Rls scope
```

## Design

- **Generic.** The package knows nothing about your identity model. You supply one
  `resolveContext()` (query path) and `resolveClaims(principal)` (realtime path) via
  `RlsModule.forRootAsync`. Claims can be any shape.
- **CLS-free.** The package never imports `nestjs-cls`. Read your request context inside
  your resolver; the package only calls the callback.
- **Scopes are mingo predicates** — flat conditions over the entity's own columns. The same
  scope works as a TypeORM `WHERE` (query path) and an in-memory predicate (realtime path).

## Subpaths

- `.` — `@Rls`, `@RlsExempt`, `getRlsPolicy`, `applyPolicy`, types.
- `./nest` — `RlsModule`, `Db` (`db.scoped(Entity)`), `ScopedRepository`, `RlsForbiddenError`.
- `./typeorm` — `toFindOptionsWhere` (mingo → TypeORM `FindOptionsWhere`).
- `./pg-realtime` — `rlsGuard(entity, resolveClaims)` bridge (optional peer `@workspace/pg-realtime`).
