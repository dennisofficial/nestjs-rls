import { describe, expect, it } from 'vitest';
import { Rls, RlsExempt } from './decorator';
import { getRlsPolicy, isRlsExempt } from './metadata';

describe('@Rls / @RlsExempt / getRlsPolicy', () => {
  it('@Rls stores a retrievable policy', () => {
    @Rls<any, { o: string[] }>((c) => ({ orgId: { $in: c.o } }))
    class Foo {}
    expect(typeof getRlsPolicy(Foo)).toBe('function');
  });

  it('@RlsExempt wins over @Rls → getRlsPolicy is undefined (allow-all)', () => {
    @RlsExempt()
    @Rls(() => ({ x: 1 }))
    class Bar {}
    expect(isRlsExempt(Bar)).toBe(true);
    expect(getRlsPolicy(Bar)).toBeUndefined();
  });

  it('supports a `static rls` fallback', () => {
    class Baz {
      static rls = { read: () => true };
    }
    expect(getRlsPolicy(Baz)).toBeDefined();
  });

  it('undecorated entity → undefined (allow-all)', () => {
    class Plain {}
    expect(getRlsPolicy(Plain)).toBeUndefined();
  });
});
