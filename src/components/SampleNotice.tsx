interface Props {
  onClear(): void;
  onHide(): void;
}

/** Says the tasks on screen are samples, and how to be rid of them. */
export function SampleNotice({ onClear, onHide }: Props) {
  return (
    <div className="notice" role="note">
      <p className="notice__text">
        These are sample tasks, here so the app isn’t empty while you try it. Clearing them
        removes only the samples.
      </p>
      <div className="button-row">
        <button type="button" className="button" onClick={onClear}>
          Clear sample tasks
        </button>
        <button type="button" className="button" onClick={onHide}>
          Hide
        </button>
      </div>
    </div>
  );
}
