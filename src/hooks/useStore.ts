import { useEffect, useState } from 'react';
import { repository } from '../store';
import type { Project, Task } from '../types/task';
import type { Settings } from '../types/settings';
import type { DayLog, PathPattern } from '../types/path';

/**
 * The app's window onto the store: live subscriptions, rendered directly.
 *
 * `null` means "not delivered yet" — a real state, because both backends fire
 * their first callback asynchronously. An empty array is an answer; null is
 * the absence of one.
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

/**
 * `null` here means two different things that behave the same way: not
 * delivered yet, and never written. Both resolve to defaults at the call
 * site, so a fresh install and a slow first snapshot look identical.
 */
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => repository.subscribeSettings(setSettings), []);
  return settings;
}

/** The week's arrangement. `null` until delivered, or when none exists yet. */
export function usePathPattern(): PathPattern | null {
  const [pattern, setPattern] = useState<PathPattern | null>(null);
  useEffect(() => repository.subscribePathPattern(setPattern), []);
  return pattern;
}

/** Every day the app has recorded anything for. */
export function useDayLogs(): DayLog[] | null {
  const [logs, setLogs] = useState<DayLog[] | null>(null);
  useEffect(() => repository.subscribeDayLogs(setLogs), []);
  return logs;
}
