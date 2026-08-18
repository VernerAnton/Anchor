import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import { buildTaskList, countFor, hasLabel, selectionKey } from './views';

const TODAY = '2026-08-13';
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

describe('hasLabel', () => {
  it('reads the array, and tolerates a task written before labels', () => {
    expect(hasLabel(task({ labelIds: ['l1'] }), 'l1')).toBe(true);
    expect(hasLabel(task({ labelIds: ['l1'] }), 'l2')).toBe(false);
    expect(hasLabel({ ...task(), labelIds: undefined } as unknown as Task, 'l1')).toBe(false);
  });
});

describe('the label view', () => {
  it('gathers tasks from every project into one list', () => {
    const a = task({ labelIds: ['l1'], projectId: 'p1' });
    const b = task({ labelIds: ['l1'], projectId: 'p2' });
    const other = task({ labelIds: ['l2'], projectId: 'p1' });
    const model = buildTaskList({ kind: 'label', labelId: 'l1' }, [a, b, other], TODAY);
    expect(model.sections[0]!.items.map((i) => i.task.id)).toEqual([a.id, b.id]);
  });

  // A label goes on a specific task. Hiding a labelled subtask because its
  // parent isn't labelled would lose the thing you actually tagged.
  it('includes a labelled subtask on its own merits', () => {
    const parent = task({ labelIds: [] });
    const child = task({ labelIds: ['l1'], parentId: parent.id });
    const model = buildTaskList({ kind: 'label', labelId: 'l1' }, [parent, child], TODAY);
    expect(model.sections[0]!.items.map((i) => i.task.id)).toEqual([child.id]);
  });

  it('separates what is done from what is open', () => {
    const open = task({ labelIds: ['l1'] });
    const done = task({ labelIds: ['l1'], completedAt: 5 });
    const model = buildTaskList({ kind: 'label', labelId: 'l1' }, [open, done], TODAY);
    expect(model.sections[0]!.items.map((i) => i.task.id)).toEqual([open.id]);
    expect(model.completed.map((t) => t.id)).toEqual([done.id]);
  });

  it('leaves archived tasks out', () => {
    const gone = task({ labelIds: ['l1'], archived: true });
    const model = buildTaskList({ kind: 'label', labelId: 'l1' }, [gone], TODAY);
    expect(model.sections[0]!.items).toEqual([]);
  });

  it('counts only what is open', () => {
    const tasks = [
      task({ labelIds: ['l1'] }),
      task({ labelIds: ['l1'], completedAt: 5 }),
      task({ labelIds: ['l2'] }),
    ];
    expect(countFor({ kind: 'label', labelId: 'l1' }, tasks, TODAY)).toBe(1);
  });

  // Two axes, two key spaces — a project and a label sharing an id must never
  // resolve to the same selection.
  it('keys a label apart from a project of the same id', () => {
    expect(selectionKey({ kind: 'label', labelId: 'x' })).toBe('label:x');
    expect(selectionKey({ kind: 'project', projectId: 'x' })).toBe('project:x');
  });
});
