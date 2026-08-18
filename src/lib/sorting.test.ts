import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import type { TaskListItem } from './views';
import { compareTasks, sortItems } from './sorting';

let n = 0;
function task(overrides: Partial<Task> = {}): Task {
  n += 1;
  return {
    id: `t${n}`,
    title: `Task ${n}`,
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: null,
    recurrence: null,
    completedAt: null,
    order: n,
    archived: false,
    firstMove: null,
    type: null,
    defaultDuration: null,
    labelIds: [],
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
    ...overrides,
  };
}

const item = (t: Task): TaskListItem => ({ task: t, subtasks: [] });
const order = (items: TaskListItem[]) => items.map((i) => i.task.title);

describe('sorting by priority', () => {
  const p1 = task({ title: 'P1', priority: 1 });
  const p3 = task({ title: 'P3', priority: 3 });
  const none = task({ title: 'None' });
  const items = [none, p3, p1].map(item);

  it('puts the strongest pull at the top', () => {
    expect(order(sortItems(items, 'priority', false))).toEqual(['P1', 'P3', 'None']);
  });

  // Unprioritised is not a P5. It goes last because something has to, and last
  // is the reading that implies no judgement about it.
  it('leaves anything unprioritised at the end', () => {
    const sorted = sortItems(items, 'priority', false);
    expect(order(sorted).at(-1)).toBe('None');
  });

  // If you flip the list, the bottom becomes the top. That includes the blanks.
  it('reverses into exactly the list read from the bottom', () => {
    expect(order(sortItems(items, 'priority', true))).toEqual(['None', 'P3', 'P1']);
  });
});

describe('the other sorts', () => {
  it('puts the soonest due date first, undated last', () => {
    const soon = task({ title: 'Soon', dueDate: '2026-08-01' });
    const later = task({ title: 'Later', dueDate: '2026-09-01' });
    const never = task({ title: 'Never' });
    expect(order(sortItems([never, later, soon].map(item), 'due', false))).toEqual([
      'Soon',
      'Later',
      'Never',
    ]);
  });

  it('sorts by name', () => {
    const items = [task({ title: 'Cherry' }), task({ title: 'Apple' }), task({ title: 'Blossom' })];
    expect(order(sortItems(items.map(item), 'name', false))).toEqual([
      'Apple',
      'Blossom',
      'Cherry',
    ]);
  });

  it('keeps the order you arranged yourself', () => {
    const third = task({ title: 'Third', order: 3 });
    const first = task({ title: 'First', order: 1 });
    expect(order(sortItems([third, first].map(item), 'manual', false))).toEqual(['First', 'Third']);
  });

  // What every list used before there was a choice.
  it('reads priority, then date, then your own order', () => {
    const urgent = task({ title: 'Urgent', priority: 1, dueDate: '2026-09-01' });
    const soonish = task({ title: 'Soonish', priority: 2, dueDate: '2026-08-01' });
    const tie = task({ title: 'Tie', priority: 2, dueDate: '2026-08-01', order: 0 });
    expect(order(sortItems([soonish, tie, urgent].map(item), 'smart', false))).toEqual([
      'Urgent',
      'Tie',
      'Soonish',
    ]);
  });
});

describe('stability', () => {
  // Without a stable tail, adding a task elsewhere reshuffles rows that had
  // nothing to do with it.
  it('breaks every tie the same way every time', () => {
    const a = task({ title: 'Same', priority: 2 });
    const b = task({ title: 'Same', priority: 2 });
    const compare = compareTasks('priority');

    // Identical on every field the sort reads, so only the id can separate
    // them — and it must, or their order depends on how they arrived.
    expect(compare(a, b)).not.toBe(0);
    expect(Math.sign(compare(a, b))).toBe(-Math.sign(compare(b, a)));
    expect(compare(a, a)).toBe(0);

    // Same two rows, opposite input order, same answer.
    expect(order(sortItems([a, b].map(item), 'priority', false))).toEqual(
      order(sortItems([b, a].map(item), 'priority', false)),
    );
  });

  it('sorts subtasks with their parent', () => {
    const parent = task({ title: 'Parent' });
    const lo = task({ title: 'Low', priority: 4 });
    const hi = task({ title: 'High', priority: 1 });
    const [sorted] = sortItems([{ task: parent, subtasks: [lo, hi] }], 'priority', false);
    expect(sorted!.subtasks.map((t) => t.title)).toEqual(['High', 'Low']);
  });

  it('leaves the list it was given alone', () => {
    const items = [task({ title: 'B' }), task({ title: 'A' })].map(item);
    const before = order(items);
    sortItems(items, 'name', false);
    expect(order(items)).toEqual(before);
  });
});
