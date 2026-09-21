import { describe, expect, it } from 'vitest';
import type { Label, Project, Task } from '../types/task';
import type { TaskListItem, TaskSection } from './views';
import { groupItems, regroup } from './grouping';

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

const project = (id: string, name: string, order: number, archived = false): Project => ({
  id, name, colorId: 'steel', parentId: null, order, archived,
  schemaVersion: 1, version: 1, updatedAt: 0,
});

const label = (id: string, name: string, order: number, archived = false): Label => ({
  id, name, colorId: 'steel', order, archived,
  schemaVersion: 1, version: 1, updatedAt: 0,
});

const health = project('p-health', 'Health', 1);
const study = project('p-study', 'Study', 0);
const deep = label('l-deep', 'Deep work', 1);
const quick = label('l-quick', 'Quick win', 0);

const titles = (sections: TaskSection[]) =>
  sections.map((s) => [s.title, s.items.map((i) => i.task.title)]);

describe('grouping by project', () => {
  it('makes a section per project, in the sidebar’s own order', () => {
    const a = task({ projectId: health.id });
    const b = task({ projectId: study.id });
    // Study is order 0, so it leads even though Health's task came first.
    expect(titles(groupItems([a, b].map(item), 'project', [health, study], []))).toEqual([
      ['Study', [b.title]],
      ['Health', [a.title]],
    ]);
  });

  it('puts everything unfiled in a named group at the end', () => {
    const filed = task({ projectId: health.id });
    const loose = task();
    const sections = groupItems([filed, loose].map(item), 'project', [health], []);
    expect(titles(sections)).toEqual([
      ['Health', [filed.title]],
      ['No project', [loose.title]],
    ]);
  });

  // A heading with nothing under it costs a line and says nothing.
  it('leaves out projects with nothing in them', () => {
    const only = task({ projectId: health.id });
    expect(titles(groupItems([item(only)], 'project', [health, study], []))).toEqual([
      ['Health', [only.title]],
    ]);
  });

  it('treats an archived or missing project as unfiled', () => {
    const gone = task({ projectId: 'deleted-project' });
    expect(titles(groupItems([item(gone)], 'project', [health], []))).toEqual([
      ['No project', [gone.title]],
    ]);
  });
});

describe('grouping by label', () => {
  // Having two labels is what having two labels means.
  it('shows a task under every label it carries', () => {
    const both = task({ labelIds: [deep.id, quick.id] });
    expect(titles(groupItems([item(both)], 'label', [], [quick, deep]))).toEqual([
      ['Quick win', [both.title]],
      ['Deep work', [both.title]],
    ]);
  });

  it('puts everything unlabelled in a named group at the end', () => {
    const tagged = task({ labelIds: [deep.id] });
    const bare = task();
    expect(titles(groupItems([tagged, bare].map(item), 'label', [], [deep]))).toEqual([
      ['Deep work', [tagged.title]],
      ['No label', [bare.title]],
    ]);
  });

  // An id left over from a label deleted on another device mustn't strand it.
  it('counts a task as unlabelled when its only label is gone', () => {
    const orphan = task({ labelIds: ['deleted-label'] });
    expect(titles(groupItems([item(orphan)], 'label', [], [deep]))).toEqual([
      ['No label', [orphan.title]],
    ]);
  });

  it('ignores archived labels', () => {
    const shelved = label('l-old', 'Old', 2, true);
    const t = task({ labelIds: [shelved.id] });
    expect(titles(groupItems([item(t)], 'label', [], [shelved]))).toEqual([
      ['No label', [t.title]],
    ]);
  });
});

describe('regroup', () => {
  const overdue = task({ title: 'Overdue' });
  const now = task({ title: 'Now', projectId: health.id });
  const sections: TaskSection[] = [
    { key: 'earlier', title: 'Earlier', items: [item(overdue)] },
    { key: 'today', title: 'Today', items: [item(now)] },
  ];

  it('leaves the view alone when nothing is grouped', () => {
    expect(regroup(sections, 'none', [health], [])).toEqual(sections);
  });

  // Overdue is a fact about the date. Burying it inside "Health" would lose
  // the one thing that section exists to say.
  it('keeps the date section on top and regroups the rest', () => {
    expect(titles(regroup(sections, 'project', [health], []))).toEqual([
      ['Earlier', [overdue.title]],
      ['Health', [now.title]],
    ]);
  });

  it('regroups every section when none are structural', () => {
    const flat: TaskSection[] = [{ key: 'all', title: null, items: [item(now), item(overdue)] }];
    expect(titles(regroup(flat, 'project', [health], []))).toEqual([
      ['Health', [now.title]],
      ['No project', [overdue.title]],
    ]);
  });
});
