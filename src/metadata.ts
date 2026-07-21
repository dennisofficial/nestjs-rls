import 'reflect-metadata';
import { RLS_EXEMPT, RLS_POLICY } from './decorator';
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
