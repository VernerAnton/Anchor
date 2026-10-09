import type { Label, Project, Task } from '../types/task';
import type { Settings } from '../types/settings';

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
 * Settings is a single document; `null` means it has never been written,
 * which reads as the defaults.
 */
export interface AnchorRepository {
  /** One-shot read. */
  getTasks(): Promise<Task[]>;
  subscribeTasks(cb: (tasks: Task[]) => void): Unsubscribe;
  saveTask(task: Task): Promise<void>;
  deleteTask(id: string): Promise<void>;

  getProjects(): Promise<Project[]>;
  subscribeProjects(cb: (projects: Project[]) => void): Unsubscribe;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  getLabels(): Promise<Label[]>;
  subscribeLabels(cb: (labels: Label[]) => void): Unsubscribe;
  saveLabel(label: Label): Promise<void>;
  deleteLabel(id: string): Promise<void>;

  getSettings(): Promise<Settings | null>;
  subscribeSettings(cb: (settings: Settings | null) => void): Unsubscribe;
  saveSettings(settings: Settings): Promise<void>;
}
