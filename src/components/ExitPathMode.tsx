import { useState } from 'react';

interface Props {
  onExit: () => void;
}

/**
 * The way back to the to-do side.
 *
 * Deliberately small and in a corner. It has to exist — being unable to leave
 * would be a trap — but it shouldn't invite you out of the path and into
 * rearranging tasks, which is the exact thing this app is trying not to be.
 * The confirmation is the same idea: one deliberate step, not a stray tap.
 */
export function ExitPathMode({ onExit }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        className="path-exit"
        aria-label="Exit path mode"
        onClick={() => setConfirming(true)}
      >
        ✕
      </button>

      {confirming && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Exit path mode">
            <p className="modal__text">Leave the path and go back to the task list?</p>
            <div className="field-row">
              <button type="button" className="btn btn--primary" onClick={onExit}>
                Leave the path
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => setConfirming(false)}>
                Stay
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
