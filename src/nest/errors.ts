/**
 * Thrown when a scoped access is denied (policy said `false`, or the row is outside the
 * caller's scope). Apps typically map this to a 404 in an exception filter, so "forbidden"
 * and "not found" are indistinguishable and existence never leaks.
 */
export class RlsForbiddenError extends Error {
  constructor(entity?: string) {
    super(entity ? `RLS: access denied for ${entity}` : 'RLS: access denied');
    this.name = 'RlsForbiddenError';
  }
}
