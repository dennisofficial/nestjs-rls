import { describe, expect, it } from 'vitest';
import { applyPolicy, mingoAnd } from './policy';
import type { RlsPolicy } from './types';

describe('applyPolicy', () => {
  it('no policy (exempt/undecorated) → allow all', async () => {
    expect(await applyPolicy(undefined, {})).toEqual({ allowed: true, scope: {} });
  });

  it('function policy → scope over claims', async () => {
    const p: RlsPolicy<{ o: string[] }> = (c) => ({ orgId: { $in: c.o } });
    expect(await applyPolicy(p, { o: ['a'] })).toEqual({
      allowed: true,
      scope: { orgId: { $in: ['a'] } },
    });
  });

  it('function policy sees the action (member-read / owner-write)', async () => {
    const p: RlsPolicy<{ r: string[]; w: string[] }> = (c, a) => ({
      orgId: { $in: a === 'read' ? c.r : c.w },
    });
    expect((await applyPolicy(p, { r: ['m'], w: ['o'] }, 'read')).scope).toEqual({
      orgId: { $in: ['m'] },
    });
    expect((await applyPolicy(p, { r: ['m'], w: ['o'] }, 'update')).scope).toEqual({
      orgId: { $in: ['o'] },
    });
  });

  it('object policy falls back to read for writes', async () => {
    const p: RlsPolicy = { read: () => ({ x: 1 }) };
    expect((await applyPolicy(p, {}, 'delete')).scope).toEqual({ x: 1 });
  });

  it('false → deny; true → allow all', async () => {
    expect(await applyPolicy(() => false, {})).toEqual({ allowed: false, scope: {} });
    expect(await applyPolicy(() => true, {})).toEqual({ allowed: true, scope: {} });
  });
});

describe('mingoAnd', () => {
  it('drops empties, unwraps a single, wraps many', () => {
    expect(mingoAnd({}, null, undefined)).toEqual({});
    expect(mingoAnd({ a: 1 })).toEqual({ a: 1 });
    expect(mingoAnd({ a: 1 }, { b: 2 })).toEqual({ $and: [{ a: 1 }, { b: 2 }] });
  });
});
