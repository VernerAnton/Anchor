import { describe, expect, it } from 'vitest';
import { parseHash, selectionHref } from './selection';

describe('selection', () => {
  it('round-trips through the URL hash', () => {
    for (const s of [
      { kind: 'today' },
      { kind: 'upcoming' },
      { kind: 'all' },
      { kind: 'project', projectId: 'a b/c' },
      { kind: 'label', labelId: 'x' },
      { kind: 'labels' },
      { kind: 'settings' },
      { kind: 'search', query: '' },
      { kind: 'search', query: 'call the bank / 50%' },
    ] as const) {
      expect(parseHash(selectionHref(s))).toEqual(s);
    }
  });

  it('falls back to Today for anything it doesn’t recognise', () => {
    expect(parseHash('')).toEqual({ kind: 'today' });
    expect(parseHash('#nonsense')).toEqual({ kind: 'today' });
  });
});
