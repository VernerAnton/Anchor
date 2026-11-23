import { useEffect } from 'react';

export interface NoticeModel {
  text: string;
  /** Present when the thing just done can be put back. */
  undo: (() => void) | null;
}

interface Props {
  notice: NoticeModel;
  onDismiss(): void;
}

/** How long a notice stays before it goes on its own. Long enough to reach Undo. */
const NOTICE_MS = 10_000;

/** A brief word about something that just happened, with a way back if there is one. */
export function Notice({ notice, onDismiss }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice, onDismiss]);

  return (
    <div className="notice" role="status">
      <p className="notice__text">{notice.text}</p>
      <div className="button-row">
        {notice.undo && (
          <button
            type="button"
            className="button"
            onClick={() => {
              notice.undo?.();
              onDismiss();
            }}
          >
            Undo
          </button>
        )}
        <button type="button" className="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
