/**
 * Manual reordering, as data: given a list as it's shown and a move, the new
 * `order` values to write.
 *
 * Only the moved task is rewritten — it takes a value between its new
 * neighbours — so a move is one document, and two devices reordering
 * different parts of a list don't fight over every row. Orders are plain
 * numbers, so halving the gap always fits until the gaps get absurdly small;
 * when two neighbours have collided, the whole list is renumbered once.
 *
 * Works on the list as displayed, so it's right in reverse too: dropping a
 * task "above" a row means above it on screen, whichever way the numbers run.
 */

export interface Ordered {
  id: string;
  order: number;
}

export interface OrderChange {
  id: string;
  order: number;
}

export function reorderPlan(
  shown: readonly Ordered[],
  id: string,
  toIndex: number,
  reverse: boolean,
): OrderChange[] {
  const from = shown.findIndex((item) => item.id === id);
  if (from === -1) return [];
  const rest = shown.filter((item) => item.id !== id);
  const at = Math.max(0, Math.min(toIndex, rest.length));
  if (at === from) return [];

  const step = reverse ? -1 : 1;
  const before = rest[at - 1];
  const after = rest[at];

  let order: number;
  if (before && after) order = (before.order + after.order) / 2;
  else if (before) order = before.order + step;
  else if (after) order = after.order - step;
  else return [];

  const collided =
    (before !== undefined && order === before.order) || (after !== undefined && order === after.order);
  if (!collided) return [{ id, order }];

  // Neighbours share a value — renumber the list as it will now read.
  const next = [...rest.slice(0, at), shown[from]!, ...rest.slice(at)];
  return next.map((item, index) => ({ id: item.id, order: reverse ? next.length - index : index + 1 }));
}
