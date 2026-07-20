import { describe, expect, it } from 'vitest';
import { FindOperator, In } from 'typeorm';
import { mergeScopedWhere, toFindOptionsWhere } from './index';

describe('toFindOptionsWhere', () => {
  it('$in → In()', () => {
    const w = toFindOptionsWhere({ orgId: { $in: ['a', 'b'] } }) as any;
    expect(w.orgId).toBeInstanceOf(FindOperator);
    expect(w.orgId.value).toEqual(['a', 'b']);
  });

  it('scalar → implicit equality', () => {
    expect(toFindOptionsWhere({ status: 'OPEN' })).toEqual({ status: 'OPEN' });
  });

  it('throws on an untranslatable operator (never guesses)', () => {
    expect(() => toFindOptionsWhere({ x: { $regex: 'y' } })).toThrow(/cannot translate/);
  });
});

describe('mergeScopedWhere', () => {
  it('a caller filter cannot WIDEN the scope — collisions AND', () => {
    const merged = mergeScopedWhere({ orgId: In(['a']) } as any, { orgId: 'b' }) as any;
    expect(merged.orgId).toBeInstanceOf(FindOperator);
    expect(merged.orgId.type).toBe('and');
  });

  it('keeps distinct caller fields alongside the scope', () => {
    const merged = mergeScopedWhere({ orgId: In(['a']) } as any, { status: 'OPEN' }) as any;
    expect(merged.status).toBe('OPEN');
    expect(merged.orgId).toBeInstanceOf(FindOperator);
  });

  it('undefined caller → scope unchanged', () => {
    const scope = { orgId: In(['a']) } as any;
    expect(mergeScopedWhere(scope)).toBe(scope);
  });
});
