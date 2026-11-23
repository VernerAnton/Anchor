import { describe, expect, it } from 'vitest';
import type { Label } from '../types/task';
import {
  findLabelByName,
  normalizeLabelName,
  splitLabelInput,
  suggestLabels,
} from './labelSearch';

let n = 0;
function label(overrides: Partial<Label> = {}): Label {
  n += 1;
  return {
    id: `l${n}`,
    name: `Label ${n}`,
    colorId: 'steel',
    order: n,
    archived: false,
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
    ...overrides,
  };
}

const focus = label({ id: 'focus', name: 'Focus', order: 1 });
const deep = label({ id: 'deep', name: 'Deep work', order: 0 });
const gone = label({ id: 'gone', name: 'Retired', order: 2, archived: true });
const all = [focus, deep, gone];

const names = (list: ReturnType<typeof suggestLabels>) =>
  list.map((s) => (s.kind === 'create' ? `+${s.name}` : s.label.name));

describe('naming a label', () => {
  it('trims and collapses the whitespace typing leaves behind', () => {
    expect(normalizeLabelName('  deep   work ')).toBe('deep work');
  });

  it('matches an existing label whatever the case', () => {
    expect(findLabelByName(all, 'FOCUS')?.id).toBe('focus');
    expect(findLabelByName(all, ' focus ')?.id).toBe('focus');
  });

  it('does not match an archived one — the name is free again', () => {
    expect(findLabelByName(all, 'Retired')).toBeNull();
  });

  it('matches nothing on an empty name', () => {
    expect(findLabelByName(all, '   ')).toBeNull();
  });
});

describe('what the box offers', () => {
  it('offers everything available when nothing is typed, in the list order', () => {
    expect(names(suggestLabels(all, [], ''))).toEqual(['Deep work', 'Focus']);
  });

  it('leaves out what the task already wears', () => {
    expect(names(suggestLabels(all, ['deep'], ''))).toEqual(['Focus']);
  });

  it('leaves out archived labels', () => {
    expect(names(suggestLabels(all, [], 'retired'))).toEqual(['+retired']);
  });

  it('matches anywhere in the name, not only the start', () => {
    expect(names(suggestLabels(all, [], 'work'))).toEqual(['Deep work', '+work']);
  });

  it('offers to make one when nothing is called that', () => {
    expect(names(suggestLabels(all, [], 'errand'))).toEqual(['+errand']);
  });

  it('does not offer to make one that already exists', () => {
    expect(names(suggestLabels(all, [], 'focus'))).toEqual(['Focus']);
  });

  /** A name the task already wears is not a new label either. */
  it('does not offer to make one the task is already wearing', () => {
    expect(names(suggestLabels(all, ['focus'], 'Focus'))).toEqual([]);
  });

  it('normalizes the name it would create', () => {
    expect(names(suggestLabels(all, [], '  deep  focus  '))).toEqual(['+deep focus']);
  });
});

describe('commas', () => {
  it('keeps what is still being typed', () => {
    expect(splitLabelInput('foc')).toEqual({ commit: [], rest: 'foc' });
  });

  it('finishes a name on the comma', () => {
    expect(splitLabelInput('focus,')).toEqual({ commit: ['focus'], rest: '' });
  });

  it('takes a whole pasted list at once', () => {
    expect(splitLabelInput('focus, deep work, errand')).toEqual({
      commit: ['focus', 'deep work'],
      rest: 'errand',
    });
  });

  it('drops the empty pieces a stray comma leaves', () => {
    expect(splitLabelInput('focus,,')).toEqual({ commit: ['focus'], rest: '' });
  });

  it('keeps the spaces inside a name, not the one after the comma', () => {
    expect(splitLabelInput('a, deep work')).toEqual({ commit: ['a'], rest: 'deep work' });
  });
});
