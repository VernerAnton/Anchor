import { APP_VERSION } from '../version';

interface Props {
  onReload: () => void;
  onDismiss: () => void;
}

/**
 * Says a newer build is ready, and leaves the choice with the user.
 *
 * Offered rather than forced, for the same reason the rest of the app offers
 * rather than forces: a reload you didn't ask for throws away whatever you were
 * typing. Declining costs nothing — the offer comes back on the next check.
 */
export function UpdatePrompt({ onReload, onDismiss }: Props) {
  return (
    <div className="update-prompt" role="status">
      <p className="update-prompt__text">
        A newer version is ready. You're on V{APP_VERSION}.
      </p>
      <div className="field-row">
        <button type="button" className="btn btn--primary" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="btn btn--quiet" onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
