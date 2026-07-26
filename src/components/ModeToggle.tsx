/**
 * Scenic mode is v3. It's shown but inert on purpose — when it does land it
 * has to be a genuinely separate tree that unmounts when you leave it, not a
 * hidden panel quietly animating a cityscape behind the functional UI.
 */
export function ModeToggle() {
  return (
    <div className="modes">
      <button type="button" className="on" aria-pressed="true">
        FOCUS
      </button>
      <button type="button" disabled title="Not built yet">
        SCENIC
      </button>
    </div>
  );
}
