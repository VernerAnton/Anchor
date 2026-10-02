import type { Task } from '../types/task';

export type Unsubscribe = () => void;

/**
 * Everything the app knows how to store, expressed the way Firestore expresses
 * it: one-shot reads, live subscriptions, and whole-document writes.
 *
 * The subscription methods are the point. Firestore delivers data through
 * `onSnapshot` — a listener that fires now and again whenever a document
 * changes, on any device. Code written against a synchronous
 * `localStorage.getItem` has to be torn up to accept that; code written against
 * a subscription does not. So the app subscribes from the start, even while
 * the only backend is local.
 *
 * Callbacks are always invoked asynchronously, including the first, because
 * that is what Firestore does. The loading state is handled now rather than
 * discovered later.
 *
 * Projects, labels and settings join this interface as they're built; adding
 * methods to a backend is mechanical.
 */
export interface AnchorRepository {
  /** One-shot read. */
  getTasks(): Promise<Task[]>;
  subscribeTasks(cb: (tasks: Task[]) => void): Unsubscribe;
  saveTask(task: Task): Promise<void>;
  deleteTask(id: string): Promise<void>;
}
