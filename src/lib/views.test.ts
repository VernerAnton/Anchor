import { describe, expect, it } from 'vitest';
import { buildList, countFor, focusAfterToggle, labelsScreen, noteLine, taskDetail, type ViewInput } from './views';
import { newLabel } from '../store/mutations';
import type { ViewOptions } from '../types/settings';
import { emptyTaskDraft, newProject, newTask } from '../store/mutations';
import type { Label, Project, Task } from '../types/task';
import type { ListSelection } from './selection';

const TODAY = '2026-10-02'; // a Friday

let seq = 0;
function task(overrides: Partial<Task>): Task {
  seq += 1;
  return { ...newTask({ ...emptyTaskDraft(), title: `Task ${seq}` }, seq, 0), ...overrides };
}

function project(overrides: Partial<Project>): Project {
  return { ...newProject({ name: 'Home', colorId: 'sage', parentId: null }, 1, 0), ...overrides };
}

function label(overrides: Partial<Label>): Label {
  return { ...newLabel('Focus', 'violet', 1, 0), ...overrides };
}

function view(
  selection: ListSelection,
  tasks: Task[],
  projects: Project[] = [],
  labels: Label[] = [],
  options?: ViewOptions,
) {
  const input: ViewInput = { selection, tasks, projects, labels, today: TODAY, options };
  return buildList(input);
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('Today', () => {
  it('puts dates that have gone by in Earlier, above Today — never "overdue"', () => {
    const list = view({ kind: 'today' }, [
      task({ id: 'now', dueDate: TODAY }),
      task({ id: 'before', dueDate: '2026-09-28' }),
      task({ id: 'later', dueDate: '2026-10-05' }),
      task({ id: 'undated' }),
    ]);
    expect(list.sections.map((s) => s.title)).toEqual(['Earlier', 'Today']);
    expect(ids(list.sections[0]!.rows)).toEqual(['before']);
    expect(ids(list.sections[1]!.rows)).toEqual(['now']);
    expect(JSON.stringify(list).toLowerCase()).not.toContain('overdue');
  });

  it('prints the date in Earlier but not under the Today heading that already says it', () => {
    const list = view({ kind: 'today' }, [
      task({ id: 'now', dueDate: TODAY }),
      task({ id: 'before', dueDate: '2026-09-28' }),
    ]);
    expect(list.sections[0]!.rows[0]!.due).toEqual({ label: 'Mon 28 Sep', past: true });
    expect(list.sections[1]!.rows[0]!.due).toBeNull();
  });

  it('leaves out empty sections, and lists only what was completed today', () => {
    const list = view({ kind: 'today' }, [
      task({ id: 'done-today', completedAt: new Date(2026, 9, 2, 9).getTime() }),
      task({ id: 'done-before', completedAt: new Date(2026, 8, 30, 9).getTime() }),
    ]);
    expect(list.sections).toEqual([]);
    expect(ids(list.completed)).toEqual(['done-today']);
  });

  it('quick add gives a new task today’s date', () => {
    expect(view({ kind: 'today' }, []).quickAdd).toMatchObject({ dueDate: TODAY, projectId: null });
  });
});

describe('Upcoming', () => {
  it('makes one section per date, spelled out, with no date repeated on the rows', () => {
    const list = view({ kind: 'upcoming' }, [
      task({ id: 'a', dueDate: '2026-10-07' }),
      task({ id: 'b', dueDate: '2026-10-03' }),
      task({ id: 'c', dueDate: '2027-01-04' }),
    ]);
    expect(list.sections.map((s) => s.title)).toEqual([
      'Tomorrow · Saturday 3 Oct',
      'Wednesday · 7 Oct',
      'Monday · 4 Jan 2027',
    ]);
    expect(list.sections.every((s) => s.rows.every((r) => r.due === null))).toBe(true);
  });

  it('quick add lands on tomorrow, and says so', () => {
    expect(view({ kind: 'upcoming' }, []).quickAdd).toEqual({
      placeholder: 'Add a task for tomorrow',
      dueDate: '2026-10-03',
      projectId: null,
      labelIds: [],
    });
  });
});

describe('subtasks', () => {
  it('nest under their parent when it is in the same section', () => {
    const parent = task({ id: 'p', dueDate: TODAY });
    const list = view({ kind: 'today' }, [parent, task({ id: 's', parentId: 'p' })]);
    expect(ids(list.sections[0]!.rows)).toEqual(['p']);
    expect(ids(list.sections[0]!.rows[0]!.subtasks)).toEqual(['s']);
  });

  it('an undated subtask follows its parent’s date', () => {
    const list = view({ kind: 'upcoming' }, [
      task({ id: 'p', dueDate: '2026-10-09' }),
      task({ id: 's', parentId: 'p' }),
    ]);
    expect(list.sections[0]!.rows[0]!.subtasks.map((r) => r.id)).toEqual(['s']);
  });

  it('stand on their own, saying whose they are, when the parent is elsewhere', () => {
    const list = view({ kind: 'today' }, [
      task({ id: 'p', title: 'Move house', dueDate: '2026-10-20' }),
      task({ id: 's', parentId: 'p', dueDate: TODAY }),
    ]);
    const row = list.sections[0]!.rows[0]!;
    expect(row.id).toBe('s');
    expect(row.parentTitle).toBe('Move house');
  });

  it('stay visible when the parent is done', () => {
    const list = view({ kind: 'all' }, [
      task({ id: 'p', completedAt: 5 }),
      task({ id: 's', parentId: 'p' }),
    ]);
    expect(ids(list.sections[0]!.rows)).toEqual(['s']);
  });
});

describe('projects', () => {
  const home = project({ id: 'home', name: 'Home' });
  const garden = project({ id: 'garden', name: 'Garden', parentId: 'home' });

  it('hide the project on rows inside that project’s own list, and show it elsewhere', () => {
    const tasks = [task({ id: 'a', projectId: 'home' })];
    expect(view({ kind: 'project', projectId: 'home' }, tasks, [home]).sections[0]!.rows[0]!.project).toBeNull();
    expect(view({ kind: 'all' }, tasks, [home]).sections[0]!.rows[0]!.project?.name).toBe('Home');
  });

  it('include sub-projects’ tasks under their own headings', () => {
    const list = view(
      { kind: 'project', projectId: 'home' },
      [task({ id: 'a', projectId: 'home' }), task({ id: 'b', projectId: 'garden' })],
      [home, garden],
    );
    expect(list.sections.map((s) => s.title)).toEqual([null, 'Garden']);
    expect(list.quickAdd).toMatchObject({ projectId: 'home', placeholder: 'Add a task to Home' });
  });

  it('count what their list shows', () => {
    const input: ViewInput = {
      selection: { kind: 'project', projectId: 'home' },
      tasks: [task({ projectId: 'home' }), task({ projectId: 'garden' }), task({ projectId: 'home', completedAt: 1 })],
      projects: [home, garden],
      labels: [],
      today: TODAY,
    };
    expect(countFor(input)).toBe(2);
  });
});

describe('ordering', () => {
  it('puts absent priorities and dates last — not as a judgement, just at the end', () => {
    const list = view({ kind: 'all' }, [
      task({ id: 'none', order: 1 }),
      task({ id: 'p2', priority: 2, order: 2 }),
      task({ id: 'p1-undated', priority: 1, order: 3 }),
      task({ id: 'p1-dated', priority: 1, dueDate: '2026-12-01', order: 4 }),
    ]);
    expect(ids(list.sections[0]!.rows)).toEqual(['p1-dated', 'p1-undated', 'p2', 'none']);
  });

  it('lists completed tasks newest first', () => {
    const list = view({ kind: 'all' }, [
      task({ id: 'old', completedAt: 1 }),
      task({ id: 'new', completedAt: 3 }),
      task({ id: 'mid', completedAt: 2 }),
    ]);
    expect(ids(list.completed)).toEqual(['new', 'mid', 'old']);
  });
});

describe('rows', () => {
  it('show the note’s first line, not a marker that a note exists', () => {
    expect(noteLine('\n  \nCall before noon\nsecond line')).toBe('Call before noon');
    expect(noteLine('   ')).toBeNull();
    expect(noteLine(null)).toBeNull();
  });
});

describe('focusAfterToggle', () => {
  const list = view({ kind: 'all' }, [
    task({ id: 'a', order: 1 }),
    task({ id: 'b', order: 2 }),
    task({ id: 'c', order: 3 }),
  ]);

  it('hands focus to the row that takes the completed one’s place', () => {
    expect(focusAfterToggle(list, 'b', true)).toBe('c');
    expect(focusAfterToggle(list, 'c', true)).toBe('b');
  });

  it('follows a reopened row', () => {
    expect(focusAfterToggle(list, 'gone', false)).toBe('gone');
  });
});

describe('taskDetail', () => {
  it('gives a parent its subtasks, and a subtask its parent and no subtasks of its own', () => {
    const tasks = [task({ id: 'p', title: 'Parent' }), task({ id: 's', parentId: 'p' })];
    const input = { tasks, projects: [], labels: [], today: TODAY };
    expect(taskDetail(input, 'p')?.subtasks?.map((r) => r.id)).toEqual(['s']);
    const sub = taskDetail(input, 's');
    expect(sub?.subtasks).toBeNull();
    expect(sub?.parent).toEqual({ id: 'p', title: 'Parent' });
    expect(taskDetail(input, 'missing')).toBeNull();
  });
});

describe('sorting', () => {
  const tasks = () => [
    task({ id: 'none', title: 'B' }),
    task({ id: 'p1', title: 'C', priority: 1 }),
    task({ id: 'p3', title: 'A', priority: 3 }),
  ];
  const opts = (o: Partial<ViewOptions>): ViewOptions => ({ groupBy: 'none', sortBy: 'smart', reverse: false, ...o });

  it('sorts by the chosen key, absent values last', () => {
    const list = view({ kind: 'all' }, tasks(), [], [], opts({ sortBy: 'priority' }));
    expect(ids(list.sections[0]!.rows)).toEqual(['p1', 'p3', 'none']);
  });

  it('reverse is the list read from the bottom — absent values now first', () => {
    const list = view({ kind: 'all' }, tasks(), [], [], opts({ sortBy: 'priority', reverse: true }));
    expect(ids(list.sections[0]!.rows)).toEqual(['none', 'p3', 'p1']);
  });

  it('manual follows the stored order and says rows can be moved', () => {
    const list = view(
      { kind: 'all' },
      [task({ id: 'x', order: 3 }), task({ id: 'y', order: 1 }), task({ id: 'z', order: 2 })],
      [],
      [],
      opts({ sortBy: 'manual' }),
    );
    expect(ids(list.sections[0]!.rows)).toEqual(['y', 'z', 'x']);
    expect(list.options.manual).toBe(true);
  });
});

describe('grouping', () => {
  const home = project({ id: 'home', name: 'Home', order: 1 });
  const work = project({ id: 'work', name: 'Work', order: 2 });
  const focus = label({ id: 'focus', name: 'Focus', order: 1 });
  const quick = label({ id: 'quick', name: 'Quick win', order: 2 });

  it('keeps Earlier on top, ungrouped, and groups the rest of Today by project', () => {
    const list = view(
      { kind: 'today' },
      [
        task({ id: 'old', dueDate: '2026-09-01', projectId: 'work' }),
        task({ id: 'w', dueDate: TODAY, projectId: 'work' }),
        task({ id: 'h', dueDate: TODAY, projectId: 'home' }),
        task({ id: 'n', dueDate: TODAY }),
      ],
      [home, work],
      [],
      { groupBy: 'project', sortBy: 'smart', reverse: false },
    );
    expect(list.sections.map((s) => s.title)).toEqual(['Earlier', 'Home', 'Work', 'No project']);
    // The heading says the project, so the row doesn't.
    expect(list.sections[1]!.rows[0]!.project).toBeNull();
    expect(list.sections[0]!.rows[0]!.project?.name).toBe('Work');
  });

  it('shows a task with two labels under both, and names the unlabelled group last', () => {
    const list = view(
      { kind: 'all' },
      [task({ id: 'both', labelIds: ['focus', 'quick'] }), task({ id: 'bare' })],
      [],
      [focus, quick],
      { groupBy: 'label', sortBy: 'smart', reverse: false },
    );
    expect(list.sections.map((s) => [s.title, ids(s.rows)])).toEqual([
      ['Focus', ['both']],
      ['Quick win', ['both']],
      ['No label', ['bare']],
    ]);
    // Under "Focus", the row shows only its other label.
    expect(list.sections[0]!.rows[0]!.labels.map((l) => l.name)).toEqual(['Quick win']);
  });

  it('isn’t offered where the list is already cut along that axis', () => {
    const options = { groupBy: 'project' as const, sortBy: 'smart' as const, reverse: false };
    expect(view({ kind: 'upcoming' }, [], [], [], options).options.groupable).toBe(false);
    expect(view({ kind: 'project', projectId: 'home' }, [], [home], [], options).options.groupBy).toBe('none');
  });

  it('never makes the sidebar count a task twice', () => {
    const input: ViewInput = {
      selection: { kind: 'all' },
      tasks: [task({ labelIds: ['focus', 'quick'] })],
      projects: [],
      labels: [focus, quick],
      today: TODAY,
      options: { groupBy: 'label', sortBy: 'smart', reverse: false },
    };
    expect(countFor(input)).toBe(1);
  });
});

describe('labels', () => {
  const focus = label({ id: 'focus', name: 'Focus', order: 2 });
  const errand = label({ id: 'errand', name: 'Errand', order: 1 });

  it('show on rows in the label list’s own order', () => {
    const list = view({ kind: 'all' }, [task({ labelIds: ['focus', 'errand'] })], [], [focus, errand]);
    expect(list.sections[0]!.rows[0]!.labels.map((l) => l.name)).toEqual(['Errand', 'Focus']);
  });

  it('a label’s view gathers tasks from anywhere, hides that label on its rows, and adds it to new tasks', () => {
    const list = view(
      { kind: 'label', labelId: 'focus' },
      [task({ id: 'a', labelIds: ['focus'], projectId: 'x' }), task({ id: 'b' })],
      [project({ id: 'x', name: 'Work' })],
      [focus, errand],
    );
    expect(ids(list.sections[0]!.rows)).toEqual(['a']);
    expect(list.sections[0]!.rows[0]!.labels).toEqual([]);
    expect(list.sections[0]!.rows[0]!.project?.name).toBe('Work');
    expect(list.quickAdd).toMatchObject({ labelIds: ['focus'], placeholder: 'Add a task labelled Focus' });
  });

  it('the labels screen lists them in order with their neighbours and open counts', () => {
    const rows = labelsScreen([focus, errand], [task({ labelIds: ['focus'] }), task({ labelIds: ['focus'], completedAt: 1 })]);
    expect(rows.map((r) => [r.name, r.count, r.above, r.below])).toEqual([
      ['Errand', 0, null, 'focus'],
      ['Focus', 1, 'errand', null],
    ]);
  });
});

describe('repeating tasks', () => {
  const daily = {
    freq: 'daily' as const,
    interval: 1,
    anchor: TODAY,
    mode: 'grid' as const,
    until: null,
    remaining: null,
  };

  it('a row says briefly how often, and nothing about the mechanism', () => {
    const list = view({ kind: 'all' }, [task({ recurrence: { ...daily, mode: 'fromCompletion' } })]);
    expect(list.sections[0]!.rows[0]!.recurrence).toBe('daily');
  });

  it('the panel offers the three moves, each naming its date, with the current one marked', () => {
    const t = task({ id: 'r', dueDate: '2026-10-03', recurrence: daily });
    const detail = taskDetail({ tasks: [t], projects: [], labels: [], today: TODAY }, 'r')!;
    expect(detail.reschedule.map((o) => [o.label, o.date, o.current])).toEqual([
      ['Tomorrow', '2026-10-03', true],
      ['In a week', '2026-10-09', false],
      ['Next occurrence', '2026-10-04', false],
    ]);
    expect(detail.recurrencePreview).toContain('Next:');
  });

  it('a finished task offers no moves', () => {
    const t = task({ id: 'd', completedAt: 1 });
    expect(taskDetail({ tasks: [t], projects: [], labels: [], today: TODAY }, 'd')!.reschedule).toEqual([]);
  });
});
