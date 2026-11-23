import { describe, expect, it } from 'vitest';
import { countSamples, isSample, sampleLabels, sampleProjects, sampleTasks } from './sampleData';

const TODAY = '2026-10-10'; // a Saturday

describe('sample data', () => {
  const tasks = sampleTasks(TODAY, 0);
  const projects = sampleProjects(0);
  const labels = sampleLabels(0);

  it('marks every document by id, so clearing can never reach your own', () => {
    expect([...tasks, ...projects, ...labels].every((doc) => isSample(doc.id))).toBe(true);
    expect(countSamples(tasks, projects, labels, [{ id: 'mine' }])).toBe(tasks.length + projects.length + labels.length);
  });

  it('only points at sample projects, labels and parents that exist', () => {
    const ids = new Set([...tasks, ...projects, ...labels].map((doc) => doc.id));
    for (const task of tasks) {
      if (task.projectId) expect(ids.has(task.projectId)).toBe(true);
      if (task.parentId) expect(ids.has(task.parentId)).toBe(true);
      for (const id of task.labelIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('gives every repeating task a real date, today or later, and fills Today', () => {
    for (const task of tasks.filter((t) => t.recurrence)) {
      expect(task.dueDate).not.toBeNull();
      expect(task.dueDate! >= TODAY).toBe(true);
    }
    expect(tasks.some((t) => t.dueDate === TODAY)).toBe(true);
    expect(tasks.some((t) => t.dueDate !== null && t.dueDate < TODAY)).toBe(true);
  });

  it('carries no undefined field — Firestore would reject the whole write', () => {
    for (const doc of [...tasks, ...projects, ...labels]) {
      for (const value of Object.values(doc)) expect(value).not.toBeUndefined();
    }
  });
});
