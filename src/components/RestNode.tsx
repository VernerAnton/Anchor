import type { CSSProperties } from 'react';
import type { RestView } from '../lib/route';
import { restTrailLength } from '../lib/time';

/**
 * Rest renders as trail with real length, never as blank space between
 * cards — and it has no control of any kind on it. There is nothing here to
 * complete, dismiss, or skip, because the whole job of this segment is to
 * take up legitimate room on the path.
 */
export function RestNode({ view }: { view: RestView }) {
  const { rest, ahead } = view;
  const style = { '--len': `${restTrailLength(rest.minutes)}px` } as CSSProperties;

  return (
    <li className={`n rest${ahead ? ' ahead' : ''}`} style={style}>
      <span className="pip" aria-hidden="true" />
      <div className="rest-strip">
        <b>REST{rest.label ? ` · ${rest.label}` : ''}</b> {rest.minutes} MIN{' '}
        <em>NO ACTION</em>
      </div>
    </li>
  );
}
