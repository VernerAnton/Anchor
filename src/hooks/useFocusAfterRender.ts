import { useCallback, useEffect, useRef } from 'react';

type Find = () => HTMLElement | null;

/**
 * Moves focus once React has committed the change that caused it.
 *
 * Focus after a state change can't be moved immediately — the target may not
 * exist yet, or may still sit inside an `inert` region that's about to be
 * released — and a timer or animation frame only usually lands after the
 * commit. An effect always does. The request is held until the next render
 * commits, run once, and dropped.
 */
export function useFocusAfterRender(): (find: Find) => void {
  const pending = useRef<Find | null>(null);

  useEffect(() => {
    const find = pending.current;
    if (!find) return;
    pending.current = null;
    find()?.focus();
  });

  return useCallback((find: Find) => {
    pending.current = find;
  }, []);
}
