import type { Project, Task } from '../types/task';
import type { Settings } from '../types/settings';

export type Unsubscribe = () => void;

/**
 * Everything the app knows how to store, expressed the way Firestore expresses
 * it: one-shot reads, live subscriptions, and whole-document writes.
 *
 * The subscription methods are the point of this interface. Firestore delivers
 * data through `onSnapshot` — a listener that fires now and again whenever the
 * document changes anywhere, on any device. Code written against a synchronous
 * `localStorage.getItem` has to be torn up to accept that; code written against
 * a subscription does not. So the app subscribes from the start, even though
 * today the data is coming from the same tab it was written in.
 *
 * Callbacks are always invoked asynchronously, including the first one, because
 * that is what Firestore does. Handling the loading state is therefore forced
 * now rather than discovered later.
 *
 * The library collections are id-keyed and small enough to subscribe to whole —
 * a personal task list is hundreds of documents, not millions. Holding it
 * entirely is what lets views filter and group without a round trip. Path and
 * day documents join this interface in a later phase; adding methods to both
 * backends is mechanical.
 */
export interface AnchorRepository {
  /** One-shot read, used by the guarded migration. */
  getTasks(): Promise<Task[]>;
  subscribeTasks(cb: (tasks: Task[]) => void): Unsubscribe;
  saveTask(task: Task): Promise<void>;
  deleteTask(id: string): Promise<void>;

  /** One-shot read, used by the guarded migration. */
  getProjects(): Promise<Project[]>;
  subscribeProjects(cb: (projects: Project[]) => void): Unsubscribe;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  getSettings(): Promise<Settings | null>;
  subscribeSettings(cb: (settings: Settings | null) => void): Unsubscribe;
  saveSettings(settings: Settings): Promise<void>;
}
