import { useState, type KeyboardEvent } from 'react';
import type { Label } from '../types/task';
import type { LabelRef } from '../lib/views';
import { splitLabelInput, suggestLabels } from '../lib/labelSearch';

interface Props {
  worn: LabelRef[];
  labels: readonly Label[];
  /** Puts labels on by name, creating any that don't exist — all in one go. */
  onAddNames(names: string[]): void;
  onAddExisting(labelId: string): void;
  onRemove(labelId: string): void;
}

/**
 * One box that searches and creates. A wall of every label as a toggle answers
 * "which are on" perfectly at five labels and not at all at fifty; the chips
 * above the box keep that answer, and the box serves the commoner case of
 * knowing what you want and typing three letters of it.
 *
 * A comma finishes a label, so one paste of "focus, deep work, errand" lands
 * as three. Suggestions sit in the flow rather than floating over the fields
 * below — an overlay needs a background to hide what's under it, which is
 * exactly what stops working with no theme.
 */
export function LabelPicker({ worn, labels, onAddNames, onAddExisting, onRemove }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const suggestions = open
    ? suggestLabels(
        [...labels],
        worn.map((label) => label.id),
        query,
      )
    : [];

  const change = (value: string) => {
    const { commit, rest } = splitLabelInput(value);
    if (commit.length > 0) onAddNames(commit);
    setQuery(rest);
  };

  const pickFirst = () => {
    const first = suggestions[0];
    if (!first) return;
    if (first.kind === 'existing') onAddExisting(first.label.id);
    else onAddNames([first.name]);
    setQuery('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (query.trim()) pickFirst();
    } else if (event.key === 'Escape' && (query || open)) {
      // Backs out of the picker before Escape reaches the panel.
      event.stopPropagation();
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div className="field label-picker">
      <label className="field__label" htmlFor="label-picker-input">
        Labels
      </label>

      {worn.length > 0 && (
        <ul className="label-picker__worn" aria-label="Labels on this task">
          {worn.map((label) => (
            <li key={label.id}>
              <button
                type="button"
                className="label-chip label-chip--removable"
                data-color={label.colorId}
                aria-label={`Remove label ${label.name}`}
                onClick={() => onRemove(label.id)}
              >
                {label.name} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id="label-picker-input"
        className="text-input"
        type="text"
        autoComplete="off"
        placeholder="Type to find or make a label"
        value={query}
        aria-describedby="label-picker-hint"
        onFocus={() => setOpen(true)}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <p id="label-picker-hint" className="field__hint">
        Enter picks the first match. A comma finishes a label.
      </p>

      {suggestions.length > 0 && (
        <ul className="label-picker__suggestions" aria-label="Matching labels">
          {suggestions.map((suggestion) =>
            suggestion.kind === 'existing' ? (
              <li key={suggestion.label.id}>
                <button
                  type="button"
                  className="label-chip"
                  data-color={suggestion.label.colorId}
                  onClick={() => {
                    onAddExisting(suggestion.label.id);
                    setQuery('');
                  }}
                >
                  {suggestion.label.name}
                </button>
              </li>
            ) : (
              <li key="create">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    onAddNames([suggestion.name]);
                    setQuery('');
                  }}
                >
                  New label “{suggestion.name}”
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
