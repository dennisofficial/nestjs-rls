import { describe, expect, it } from 'vitest';
import { Expose, Rls, RlsExempt } from './decorator';
import { getExposed, getRlsPolicy, isRlsExempt } from './metadata';

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

describe('@Expose / getExposed', () => {
  it('exposes only decorated properties, secure by default', () => {
    class Foo {
      @Expose()
      name!: string;

      secret!: string;
    }
    const exposed = getExposed(Foo);
    expect(exposed.get('name')).toBe('name');
    expect(exposed.has('secret')).toBe(false);
  });

  it('supports an output-name alias', () => {
    class Foo {
      @Expose('postedAt')
      createdAt!: Date;
    }
    expect(getExposed(Foo).get('createdAt')).toBe('postedAt');
  });

  it('walks the prototype chain, merging base-class exposures', () => {
    class Base {
      @Expose()
      createdAt!: Date;
    }
    class Child extends Base {
      @Expose()
      name!: string;
    }
    const exposed = getExposed(Child);
    expect(exposed.get('createdAt')).toBe('createdAt');
    expect(exposed.get('name')).toBe('name');
  });

  it('subclass exposure wins on name collision', () => {
    class Base {
      @Expose('baseAlias')
      value!: string;
    }
    class Child extends Base {
      @Expose('childAlias')
      declare value: string;
    }
    expect(getExposed(Child).get('value')).toBe('childAlias');
  });

  it('undecorated entity → empty map', () => {
    class Plain {}
    expect(getExposed(Plain).size).toBe(0);
  });
});
