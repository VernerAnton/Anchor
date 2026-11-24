import { describe, expect, it } from 'vitest';
import { searchTasks, searchTerms } from './search';
import { emptyTaskDraft, newProject, newTask } from '../store/mutations';
import type { Task } from '../types/task';

let n = 0;
const task = (o: Partial<Task>): Task => ({ ...newTask({ ...emptyTaskDraft(), title: `T${++n}` }, n, 0), ...o });
const input = (tasks: Task[]) => ({
  tasks,
  projects: [{ ...newProject({ name: 'Home', colorId: 'sage', parentId: null }, 1, 0), id: 'home' }],
  labels: [],
  today: '2026-11-24',
});

describe('search', () => {
  it('matches every word, in any order, in the title or the notes, ignoring case', () => {
    const tasks = [
      task({ id: 'a', title: 'Call the bank' }),
      task({ id: 'b', title: 'Bank holiday plans' }),
      task({ id: 'c', title: 'Renew passport', notes: 'Photos first\nThen CALL the office' }),
    ];
    expect(searchTasks(input(tasks), 'call bank').open.map((r) => r.id)).toEqual(['a']);
    expect(searchTasks(input(tasks), 'CALL').open.map((r) => r.id).sort()).toEqual(['a', 'c']);
  });

  it('shows the note line that matched, not just the first one', () => {
    const tasks = [task({ id: 'c', title: 'Renew passport', notes: 'Photos first\nThen call the office' })];
    expect(searchTasks(input(tasks), 'office').open[0]!.note).toBe('Then call the office');
  });

  it('always shows the project — there is no heading to say it', () => {
    const tasks = [task({ id: 'a', title: 'Fix the gate', projectId: 'home' })];
    expect(searchTasks(input(tasks), 'gate').open[0]!.project?.name).toBe('Home');
  });

  it('lists open matches first and done ones separately, and leaves archived out', () => {
    const tasks = [
      task({ id: 'open', title: 'Garden: weed' }),
      task({ id: 'done', title: 'Garden: mow', completedAt: 5 }),
      task({ id: 'gone', title: 'Garden: old', archived: true }),
    ];
    const result = searchTasks(input(tasks), 'garden');
    expect(result.open.map((r) => r.id)).toEqual(['open']);
    expect(result.completed.map((r) => r.id)).toEqual(['done']);
  });

  it('says plainly when nothing matches, and asks for words when blank', () => {
    expect(searchTasks(input([]), '  ').message).toBe('Type to search titles and notes.');
    expect(searchTasks(input([]), 'zebra').message).toBe('Nothing matches “zebra”.');
    expect(searchTerms('  Two   words ')).toEqual(['two', 'words']);
  });
});
