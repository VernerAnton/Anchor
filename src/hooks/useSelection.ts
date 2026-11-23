import { useCallback, useEffect, useState } from 'react';
import { parseHash, selectionHref, type Selection } from '../lib/selection';

/**
 * The current view, read from and written to the URL hash, so reloads and the
 * back button keep your place. `replace` swaps the current history entry
 * instead of adding one — for corrections, like leaving a project that no
 * longer exists, which shouldn't be a step you can go back to.
 */
export function useSelection(): [Selection, (next: Selection, replace?: boolean) => void] {
  const [selection, setSelection] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setSelection(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Selection, replace = false) => {
    const href = selectionHref(next);
    if (replace) {
      window.history.replaceState(null, '', href);
      setSelection(next);
    } else {
      window.location.hash = href;
    }
  }, []);

  return [selection, navigate];
}
