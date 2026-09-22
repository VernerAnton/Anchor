import { useEffect, useState } from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  label: string;
  onCommit: (value: number) => void;
}

/**
 * A number input you can actually clear.
 *
 * The obvious implementation — parsing the raw input straight into the model —
 * makes the field uneditable above one digit: clearing it yields `''`, which
 * coerces to a falsy `0`, which falls back to the minimum, which repopulates
 * the box before a second digit can be typed. "Every 2 days" becomes
 * unreachable.
 *
 * So the draft is held as a string and allowed to be empty or half-typed. The
 * model only hears about values that are actually valid, and a blur with
 * nothing usable in the box restores the last committed value — the field can
 * be left mid-edit but never left broken.
 */
export function NumberField({ value, min, max, label, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value));

  // A change from elsewhere (switching frequency, selecting another task) wins
  // over a stale draft.
  useEffect(() => setDraft(String(value)), [value]);

  const change = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= min && parsed <= max) onCommit(parsed);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      aria-label={label}
      onChange={(event) => change(event.target.value)}
      onBlur={() => setDraft(String(value))}
    />
  );
}
