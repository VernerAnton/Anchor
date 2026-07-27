import { useState } from 'react';

interface Props {
  /** Label of the most recent route that could be reused, if there is one. */
  previousLabel: string | null;
  onStart: (firstThing: string) => void;
  onCopyPrevious: () => void;
}

/**
 * The hardest screen in the product.
 *
 * An empty canvas with an "add task" button is the worst thing to hand someone
 * who opened this app precisely because starting is hard — a blank page is a
 * decision, and removing decisions is the entire premise. So this asks exactly
 * one question, and it asks for the *smallest physical* thing on purpose:
 * physical because it gives visible proof that something moved, smallest
 * because the bar has to be low enough that answering feels silly to refuse.
 *
 * Reusing the last route is offered above it, because rebuilding a day from
 * nothing every night is itself a nightly chore requiring initiative — the very
 * failure this app exists to route around.
 */
export function EmptyRoute({ previousLabel, onStart, onCopyPrevious }: Props) {
  const [value, setValue] = useState('');

  return (
    <div className="empty">
      <div className="empty-hd">Nothing set for this day</div>

      {previousLabel && (
        <button type="button" className="empty-copy" onClick={onCopyPrevious}>
          Same route as {previousLabel} ►
        </button>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onStart(value.trim());
        }}
      >
        <p className="empty-q">
          What&rsquo;s the smallest
          <br />
          <em>physical</em> thing?
        </p>
        <p className="empty-fine">
          Small enough that skipping it would feel silly. Everything else can come later.
        </p>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Put the bag by the door"
          aria-label="The smallest physical thing"
        />
        <button type="submit" className="empty-go" disabled={!value.trim()}>
          Put it on the route ►
        </button>
      </form>
    </div>
  );
}
