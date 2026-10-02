import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTasks } from './hooks/useTasks';
import { useNarrowLayout } from './hooks/useNarrowLayout';
import { useFocusAfterRender } from './hooks/useFocusAfterRender';
import { allTasksView, focusAfterToggle, taskDetail } from './lib/views';
import { buildInfo } from './lib/build';
import { addTask, deleteTask, setTaskDone } from './store/actions';
import { Sidebar } from './components/Sidebar';
import { TaskListPanel } from './components/TaskListPanel';
import { DetailPanel, DetailPlaceholder } from './components/DetailPanel';

const BUILD = buildInfo();

/** Plain and blameless: the device failed a write, the person did nothing wrong. */
const WRITE_ERROR = 'That change couldn’t be saved on this device. Your other tasks are unaffected.';

/**
 * The shell: sidebar, list, detail.
 *
 * App holds only what's genuinely app-wide — which task is open, whether the
 * drawer is out — and wires the store's actions to the components. Every
 * derived state comes from `lib/views`; every write goes through
 * `store/actions`.
 */
export function App() {
  const tasks = useTasks();
  const narrow = useNarrowLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRender = useFocusAfterRender();

  const list = useMemo(() => (tasks ? allTasksView(tasks) : null), [tasks]);
  const detail = useMemo(() => taskDetail(tasks ?? [], selectedId), [tasks, selectedId]);

  const report = useCallback((write: Promise<void>) => {
    write.then(
      () => setWriteError(null),
      (error: unknown) => {
        console.warn('Write failed:', error);
        setWriteError(WRITE_ERROR);
      },
    );
  }, []);

  const findTask = useCallback((id: string) => tasks?.find((task) => task.id === id), [tasks]);

  const onAdd = useCallback(
    (title: string) => {
      if (tasks) report(addTask(title, tasks));
    },
    [tasks, report],
  );

  const onToggle = useCallback(
    (id: string, done: boolean) => {
      const task = findTask(id);
      if (!task || !list) return;
      // Only a toggle made from the row itself moves focus — the row is about
      // to move to the other list and would take focus with it.
      const fromRow = document.activeElement?.getAttribute('data-check-task') === id;
      const next = fromRow ? focusAfterToggle(list, id, done) : undefined;
      report(setTaskDone(task, done));
      if (next === undefined) return;
      focusAfterRender(
        () =>
          (next && document.querySelector<HTMLElement>(`[data-check-task="${next}"]`)) ||
          listHeadingRef.current,
      );
    },
    [findTask, list, report, focusAfterRender],
  );

  const closeDetail = useCallback(() => {
    const id = selectedId;
    setSelectedId(null);
    // Back to the row that opened it, or — if that row is gone — the list.
    focusAfterRender(
      () =>
        (id && document.querySelector<HTMLElement>(`[data-open-task="${id}"]`)) ||
        listHeadingRef.current,
    );
  }, [selectedId, focusAfterRender]);

  const onDelete = useCallback(
    (id: string) => {
      const task = findTask(id);
      if (!task) return;
      setSelectedId(null);
      report(deleteTask(task));
      focusAfterRender(() => listHeadingRef.current);
    },
    [findTask, report, focusAfterRender],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    focusAfterRender(() => menuButtonRef.current);
  }, [focusAfterRender]);

  // The drawer only exists in the narrow layout; widening the window closes it.
  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);

  useEffect(() => {
    if (drawerOpen) drawerCloseRef.current?.focus();
  }, [drawerOpen]);

  // Escape closes whatever is on top: the drawer, then the open task.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (drawerOpen) closeDrawer();
      else if (detail) closeDetail();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, detail, closeDrawer, closeDetail]);

  const drawerShown = narrow && drawerOpen;
  const overlayShown = narrow && detail !== null;

  return (
    <div className="app">
      {(!narrow || drawerOpen) && (
        <Sidebar build={BUILD} drawer={narrow} closeRef={drawerCloseRef} onClose={closeDrawer} />
      )}
      {drawerShown && <div className="drawer-backdrop" onClick={closeDrawer} />}

      <main className="app__main" inert={drawerShown || overlayShown}>
        {writeError && (
          <div className="write-error" role="alert">
            <p className="write-error__text">{writeError}</p>
            <button type="button" className="button" onClick={() => setWriteError(null)}>
              Dismiss
            </button>
          </div>
        )}
        <TaskListPanel
          title="All tasks"
          list={list}
          selectedId={detail?.id ?? null}
          onOpenMenu={narrow ? () => setDrawerOpen(true) : null}
          menuButtonRef={menuButtonRef}
          headingRef={listHeadingRef}
          onAdd={onAdd}
          onToggle={onToggle}
          onOpen={setSelectedId}
        />
      </main>

      {detail ? (
        <DetailPanel
          key={detail.id}
          detail={detail}
          overlay={narrow}
          onClose={closeDetail}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ) : (
        !narrow && <DetailPlaceholder />
      )}
    </div>
  );
}
