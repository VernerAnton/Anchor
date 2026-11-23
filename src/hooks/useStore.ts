import { useEffect, useState } from 'react';
import { repository } from '../store';
import type { Label, Project, Task } from '../types/task';
import type { Settings } from '../types/settings';

/**
 * The app's window onto the store: live subscriptions, rendered directly.
 *
 * `null` means "not delivered yet" — a real state, because the store always
 * answers asynchronously. An empty array is an answer; `null` is the absence
 * of one.
 */

export function useTasks(): Task[] | null {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => repository.subscribeTasks(setTasks), []);
  return tasks;
}

export function useProjects(): Project[] | null {
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => repository.subscribeProjects(setProjects), []);
  return projects;
}

export function useLabels(): Label[] | null {
  const [labels, setLabels] = useState<Label[] | null>(null);
  useEffect(() => repository.subscribeLabels(setLabels), []);
  return labels;
}

/**
 * `undefined` until delivered; `null` once delivered means "never written",
 * which reads as the defaults. Keeping the two apart is what lets the app wait
 * for settings without mistaking a fresh install for a slow load.
 */
export function useSettings(): Settings | null | undefined {
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined);
  useEffect(() => repository.subscribeSettings(setSettings), []);
  return settings;
}
