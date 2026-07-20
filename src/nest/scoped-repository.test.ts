import { describe, expect, it } from 'vitest';
import { Rls, RlsExempt } from '../decorator';
import type { RlsContextConfig } from '../types';
import { ScopedRepository } from './scoped-repository';

@Rls<any, { orgIds: string[] }>((c) => (c.orgIds.length ? { orgId: { $in: c.orgIds } } : false))
class ScopedThing {}

@RlsExempt()
class ExemptThing {}

function ctx(claims: unknown): RlsContextConfig {
  return { resolveContext: () => claims, resolveClaims: () => claims };
}

function fakeRepo(target: unknown) {
  const calls: Record<string, any> = {};
  const repo: any = {
    metadata: { target },
    find: async (opts: any) => {
      calls.find = opts;
      return [{ id: 1 }];
    },
    findOne: async (opts: any) => {
      calls.findOne = opts;
      return { id: 1 };
    },
  };
  return { repo, calls };
}

describe('ScopedRepository', () => {
  it('policy denies (empty membership → false) → find returns [] without hitting the DB', async () => {
    const { repo, calls } = fakeRepo(ScopedThing);
    const sr = new ScopedRepository(repo, ctx({ orgIds: [] }));
    expect(await sr.find()).toEqual([]);
    expect(calls.find).toBeUndefined();
  });

  it('ANDs the scope into the caller where', async () => {
    const { repo, calls } = fakeRepo(ScopedThing);
    const sr = new ScopedRepository(repo, ctx({ orgIds: ['a'] }));
    await sr.find({ where: { status: 'OPEN' } as any });
    expect(calls.find.where.status).toBe('OPEN');
    expect(calls.find.where.orgId).toBeDefined();
  });

  it('exempt entity → no scope, caller where passes through untouched', async () => {
    const { repo, calls } = fakeRepo(ExemptThing);
    const sr = new ScopedRepository(repo, ctx({ orgIds: [] }));
    await sr.find({ where: { x: 1 } as any });
    expect(calls.find.where).toEqual({ x: 1 });
  });

  it('assertAccess throws when the row is outside scope', async () => {
    const { repo } = fakeRepo(ScopedThing);
    const sr = new ScopedRepository(repo, ctx({ orgIds: [] }));
    await expect(sr.assertAccess({ id: '1' } as any)).rejects.toThrow(/access denied/);
  });
});
