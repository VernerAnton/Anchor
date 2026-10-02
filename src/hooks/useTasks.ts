import { useEffect, useState } from 'react';
import { repository } from '../store';
import type { Task } from '../types/task';

/**
 * The live task list. `null` means "not delivered yet" — a real state,
 * because the store always answers asynchronously. An empty array is an
 * answer; `null` is the absence of one.
 */
export function useTasks(): Task[] | null {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => repository.subscribeTasks(setTasks), []);
  return tasks;
}
