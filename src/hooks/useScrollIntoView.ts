import { useEffect, useRef } from 'react';

/**
 * Brings a panel into view when it opens.
 *
 * The editor renders below the path, so editing the first point of a long day
 * would otherwise open a form somewhere off the bottom of the screen. Hunting
 * for the thing you just asked for is a small cost, but it is exactly the kind
 * of small cost this app is supposed to stop charging.
 */
export function useScrollIntoView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({
      block: 'center',
      // Respected automatically by browsers under prefers-reduced-motion.
      behavior: 'smooth',
    });
  }, []);

  return ref;
}
