import { describe, expect, it } from 'vitest';
import { reorderPlan } from './reorder';

const list = (...orders: number[]) => orders.map((order, i) => ({ id: String.fromCharCode(97 + i), order }));

function apply(shown: { id: string; order: number }[], changes: { id: string; order: number }[], reverse = false) {
  const map = new Map(shown.map((s) => [s.id, s.order]));
  for (const c of changes) map.set(c.id, c.order);
  return [...map.entries()]
    .sort((x, y) => (reverse ? y[1] - x[1] : x[1] - y[1]))
    .map(([id]) => id)
    .join('');
}

describe('reorderPlan', () => {
  const shown = list(1, 2, 3, 4); // a b c d

  it('moves one task between its new neighbours, writing only that task', () => {
    const changes = reorderPlan(shown, 'd', 1, false);
    expect(changes).toEqual([{ id: 'd', order: 1.5 }]);
    expect(apply(shown, changes)).toBe('adbc');
  });

  it('moves to the top and the bottom', () => {
    expect(apply(shown, reorderPlan(shown, 'c', 0, false))).toBe('cabd');
    expect(apply(shown, reorderPlan(shown, 'a', 3, false))).toBe('bcda');
  });

  it('a move to where it already is changes nothing', () => {
    expect(reorderPlan(shown, 'b', 1, false)).toEqual([]);
  });

  it('works on the list as shown when reversed', () => {
    const reversed = list(4, 3, 2, 1); // shown a b c d, highest first
    expect(apply(reversed, reorderPlan(reversed, 'd', 0, true), true)).toBe('dabc');
    expect(apply(reversed, reorderPlan(reversed, 'a', 3, true), true)).toBe('bcda');
  });

  it('renumbers once when neighbours have collided', () => {
    const tied = list(1, 1, 1);
    const changes = reorderPlan(tied, 'c', 1, false);
    expect(changes.length).toBe(3);
    expect(apply(tied, changes)).toBe('acb');
  });
});
