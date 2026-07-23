import 'reflect-metadata';
import { EXPOSED, RLS_EXEMPT, RLS_POLICY } from './decorator';
import type { RlsPolicy } from './types';

export function isRlsExempt(entity: Function): boolean {
  return Reflect.getMetadata(RLS_EXEMPT, entity) === true;
}

export function getRlsPolicy<Claims = unknown, T = unknown>(
  entity: Function,
): RlsPolicy<Claims, T> | undefined {
  if (isRlsExempt(entity)) return undefined;
  const fromDecorator = Reflect.getMetadata(RLS_POLICY, entity) as RlsPolicy<Claims, T> | undefined;
  if (fromDecorator) return fromDecorator;
  return (entity as { rls?: RlsPolicy<Claims, T> }).rls;
}

/**
 * The full `propertyName -> outputName` exposure map for an entity, walking the prototype
 * chain so columns exposed on a base class (e.g. `TimestampedEntity.createdAt`) are included.
 * Subclass exposures win on name collision.
 */
export function getExposed(entity: Function): Map<string, string> {
  const merged = new Map<string, string>();
  const chain: Function[] = [];
  let current: Function | undefined = entity;
  while (current && current !== Function.prototype && current !== Object) {
    chain.push(current);
    current = Object.getPrototypeOf(current) as Function | undefined;
  }
  for (const ctor of chain.reverse()) {
    const own = Reflect.getOwnMetadata(EXPOSED, ctor) as Map<string, string> | undefined;
    if (!own) continue;
    for (const [prop, outName] of own) merged.set(prop, outName);
  }
  return merged;
}
