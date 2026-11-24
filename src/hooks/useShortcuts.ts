import { useEffect } from 'react';

interface Shortcuts {
  /** `/` — go to Search. */
  onSearch(): void;
  /** `n` — the add-a-task box, from anywhere. */
  onNewTask(): void;
}

/** Typing into a field must never trigger a shortcut. */
function typingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The app's single-key shortcuts. Plain keys only — anything with a modifier
 * belongs to the browser or the system — and never while typing.
 */
export function useShortcuts({ onSearch, onNewTask }: Shortcuts): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (typingInto(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        onSearch();
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        onNewTask();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSearch, onNewTask]);
}

/**
 * Up and Down move between tasks in the list — from a task's title to the
 * next task's title, or checkbox to checkbox — and Home and End jump to the
 * ends. Rows hidden inside a closed Completed block are skipped. The manual
 * reorder handle keeps its own arrow keys (it handles them first).
 */
export function moveAmongRows(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const attr = target.hasAttribute('data-open-task')
    ? 'data-open-task'
    : target.hasAttribute('data-check-task')
      ? 'data-check-task'
      : null;
  if (!attr) return;

  const all = [...event.currentTarget.querySelectorAll<HTMLElement>(`[${attr}]`)].filter(
    (el) => el.getClientRects().length > 0,
  );
  const index = all.indexOf(target);
  if (index === -1) return;
  const next =
    event.key === 'Home'
      ? all[0]
      : event.key === 'End'
        ? all[all.length - 1]
        : all[index + (event.key === 'ArrowDown' ? 1 : -1)];
  event.preventDefault();
  next?.focus();
}
