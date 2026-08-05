import { useEffect, useState } from 'react';
import { repository } from '../store';
import type { Project, Task } from '../types/task';

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
