import { describe, expect, it } from 'vitest';
import { buildList, countFor, focusAfterToggle, noteLine, taskDetail, type ViewInput } from './views';
import { emptyTaskDraft, newProject, newTask } from '../store/mutations';
import type { Project, Task } from '../types/task';
import type { Selection } from './selection';

const TODAY = '2026-10-02'; // a Friday

let seq = 0;
function task(overrides: Partial<Task>): Task {
  seq += 1;
  return { ...newTask({ ...emptyTaskDraft(), title: `Task ${seq}` }, seq, 0), ...overrides };
}

function project(overrides: Partial<Project>): Project {
  return { ...newProject({ name: 'Home', colorId: 'sage', parentId: null }, 1, 0), ...overrides };
}

function view(selection: Selection, tasks: Task[], projects: Project[] = []) {
  const input: ViewInput = { selection, tasks, projects, today: TODAY };
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
    const input = { tasks, projects: [], today: TODAY };
    expect(taskDetail(input, 'p')?.subtasks?.map((r) => r.id)).toEqual(['s']);
    const sub = taskDetail(input, 's');
    expect(sub?.subtasks).toBeNull();
    expect(sub?.parent).toEqual({ id: 'p', title: 'Parent' });
    expect(taskDetail(input, 'missing')).toBeNull();
  });
});
