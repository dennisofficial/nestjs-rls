import { Query } from 'mingo';
import {
  DeleteResult,
  type FindManyOptions,
  type FindOneOptions,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
  UpdateResult,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity/QueryPartialEntity';
import { getRlsPolicy } from '../metadata';
import { applyPolicy } from '../policy';
import { mergeScopedWhere, toFindOptionsWhere } from '../typeorm';
import type { MingoFilter, RlsAction, RlsContextConfig } from '../types';
import { RlsForbiddenError } from './errors';

/**
 * A TypeORM repository wrapper that resolves the entity's `@Rls` policy for the current
 * request context and applies the scope automatically: ANDed into reads, checked on writes.
 */
export class ScopedRepository<T extends ObjectLiteral> {
  private readonly target: Function;

  constructor(
    private readonly repo: Repository<T>,
    private readonly ctx: RlsContextConfig,
  ) {
    this.target = repo.metadata.target as Function;
  }

  /** The underlying, UNSCOPED repository. Audited escape hatch. */
  get raw(): Repository<T> {
    return this.repo;
  }

  // ── reads ──────────────────────────────────────────────────────────────────

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    const { allowed, scope } = await this.resolve('read');
    if (!allowed) return [];
    return this.repo.find(this.withScope(options, scope));
  }

  async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    const { allowed, scope } = await this.resolve('read');
    if (!allowed) return [[], 0];
    return this.repo.findAndCount(this.withScope(options, scope));
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const { allowed, scope } = await this.resolve('read');
    if (!allowed) return null;
    return this.repo.findOne(this.withScope(options, scope));
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    const { allowed, scope } = await this.resolve('read');
    if (!allowed) return 0;
    return this.repo.count(this.withScope(options, scope));
  }

  async exists(options?: FindManyOptions<T>): Promise<boolean> {
    const { allowed, scope } = await this.resolve('read');
    if (!allowed) return false;
    return this.repo.exists(this.withScope(options, scope));
  }

  /** Fetch one row under `action`'s scope, or `null` if denied / not found. */
  async findOneScoped(
    where: FindOptionsWhere<T>,
    action: RlsAction = 'read',
  ): Promise<T | null> {
    const { allowed, scope } = await this.resolve(action);
    if (!allowed) return null;
    return this.repo.findOne(this.withScope({ where }, scope));
  }

  /** Fetch one row under `action`'s scope, or throw `RlsForbiddenError`. */
  async assertAccess(where: FindOptionsWhere<T>, action: RlsAction = 'read'): Promise<T> {
    const row = await this.findOneScoped(where, action);
    if (!row) throw new RlsForbiddenError(this.entityName());
    return row;
  }

  // ── writes ─────────────────────────────────────────────────────────────────

  /** Insert, first asserting each candidate satisfies the `create` scope in-memory. */
  async insert(entities: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[]) {
    const { allowed, scope } = await this.resolve('create');
    if (!allowed) throw new RlsForbiddenError(this.entityName());
    if (Object.keys(scope).length > 0) {
      const q = new Query(scope as MingoFilter);
      const rows = Array.isArray(entities) ? entities : [entities];
      for (const row of rows) {
        if (!q.test(row as Record<string, unknown>)) {
          throw new RlsForbiddenError(this.entityName());
        }
      }
    }
    return this.repo.insert(entities);
  }

  /** Update, ANDing the `update` scope into the criteria so forbidden rows are untouched. */
  async update(
    criteria: FindOptionsWhere<T>,
    partial: QueryDeepPartialEntity<T>,
  ): Promise<UpdateResult> {
    const { allowed, scope } = await this.resolve('update');
    if (!allowed) return emptyUpdate();
    return this.repo.update(this.scopedCriteria(criteria, scope), partial);
  }

  async delete(criteria: FindOptionsWhere<T>): Promise<DeleteResult> {
    const { allowed, scope } = await this.resolve('delete');
    if (!allowed) return emptyDelete();
    return this.repo.delete(this.scopedCriteria(criteria, scope));
  }

  async softDelete(criteria: FindOptionsWhere<T>): Promise<UpdateResult> {
    const { allowed, scope } = await this.resolve('delete');
    if (!allowed) return emptyUpdate();
    return this.repo.softDelete(this.scopedCriteria(criteria, scope));
  }

  // ── internals ────────────────────────────────────────────────────────────────

  private async resolve(action: RlsAction): Promise<{ allowed: boolean; scope: MingoFilter }> {
    if (this.ctx.exempt?.()) return { allowed: true, scope: {} };
    const policy = getRlsPolicy(this.target);
    if (!policy) return { allowed: true, scope: {} };
    const claims = await this.ctx.resolveContext();
    return applyPolicy(policy, claims, action);
  }

  private withScope<O extends { where?: FindOptionsWhere<T> | FindOptionsWhere<T>[] }>(
    options: O | undefined,
    scope: MingoFilter,
  ): O {
    const opts = { ...(options ?? {}) } as O;
    if (Object.keys(scope).length === 0) return opts; // allow-all
    opts.where = mergeScopedWhere(toFindOptionsWhere<T>(scope), opts.where);
    return opts;
  }

  private scopedCriteria(
    criteria: FindOptionsWhere<T>,
    scope: MingoFilter,
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (Object.keys(scope).length === 0) return criteria;
    return mergeScopedWhere(toFindOptionsWhere<T>(scope), criteria);
  }

  private entityName(): string {
    return typeof this.target === 'function' ? this.target.name : String(this.target);
  }
}

function emptyUpdate(): UpdateResult {
  const r = new UpdateResult();
  r.raw = [];
  r.affected = 0;
  r.generatedMaps = [];
  return r;
}

function emptyDelete(): DeleteResult {
  const r = new DeleteResult();
  r.raw = [];
  r.affected = 0;
  return r;
}
