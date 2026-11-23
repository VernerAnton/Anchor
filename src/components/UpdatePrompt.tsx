import { APP_VERSION } from '../version';

interface Props {
  onReload(): void;
  onDismiss(): void;
}

/**
 * Says a newer build is ready, and leaves the choice with you. Offered rather
 * than forced: a reload you didn't ask for throws away whatever you were
 * typing. Declining costs nothing — the offer comes back on the next check.
 */
export function UpdatePrompt({ onReload, onDismiss }: Props) {
  return (
    <div className="notice notice--update" role="status">
      <p className="notice__text">A newer version of Anchor is ready. This one is V{APP_VERSION}.</p>
      <div className="button-row">
        <button type="button" className="button button--primary" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="button" onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
