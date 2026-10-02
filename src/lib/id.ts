/**
 * Ids are generated on the client, never by the server.
 *
 * That's a requirement rather than a convenience: a point added on a phone with
 * no signal has to get its id immediately, and it must not collide with one
 * added on a laptop in the same offline window. Random uuids make that safe
 * without coordination.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
