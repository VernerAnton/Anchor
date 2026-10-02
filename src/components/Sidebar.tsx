import type { Ref } from 'react';
import type { BuildInfo } from '../lib/build';

interface Props {
  build: BuildInfo;
  /** The narrow layout's drawer: adds a close control. */
  drawer: boolean;
  closeRef: Ref<HTMLButtonElement>;
  onClose(): void;
}

/**
 * Navigation, and the build stamp. One view exists in phase 1; Today,
 * Upcoming and the project and label views join this list in phase 2.
 */
export function Sidebar({ build, drawer, closeRef, onClose }: Props) {
  const classes = ['sidebar'];
  if (drawer) classes.push('sidebar--drawer');

  return (
    <nav id="sidebar" className={classes.join(' ')} aria-label="Views">
      <div className="sidebar__header">
        <p className="sidebar__name">Anchor</p>
        {drawer && (
          <button type="button" className="button" ref={closeRef} onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <ul className="nav-list">
        <li>
          <a className="nav-list__link" href="#all" aria-current="page" onClick={onClose}>
            All tasks
          </a>
        </li>
      </ul>

      <p className="app-version" title={build.detail}>
        {build.label}
      </p>
    </nav>
  );
}
