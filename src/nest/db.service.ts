import { Injectable } from '@nestjs/common';
import type { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import type { RlsContextConfig } from '../types';
import { ScopedRepository } from './scoped-repository';

/**
 * The global, scoped data layer. Reach any entity's repository from any module — the entity's
 * `@Rls` policy is applied automatically. No per-feature `forFeature` registration required.
 */
@Injectable()
export class Db {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ctx: RlsContextConfig,
  ) {}

  /** A scoped repository for `entity` — reads AND-ed, writes checked against `@Rls`. */
  scoped<T extends ObjectLiteral>(entity: EntityTarget<T>): ScopedRepository<T> {
    return new ScopedRepository<T>(this.dataSource.getRepository(entity), this.ctx);
  }

  /** The raw, UNSCOPED TypeORM repository. Audited escape hatch (e.g. system lookups). */
  unsafe<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.dataSource.getRepository(entity);
  }
}
