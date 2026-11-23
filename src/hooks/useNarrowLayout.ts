import { useEffect, useState } from 'react';

/**
 * Below this width the sidebar becomes a drawer and the detail panel an
 * overlay. CSS can't read a custom property inside a media query, so the same
 * literal lives in `src/styles/layout.css` — change both together.
 */
export const NARROW_QUERY = '(max-width: 59.99rem)';

/** Whether the layout is currently collapsed to its narrow form. */
export function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}
