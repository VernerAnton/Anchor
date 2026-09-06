import { useId, useState } from 'react';
import type { Label } from '../types/task';
import {
  byLabelOrder,
  splitLabelInput,
  suggestLabels,
  type LabelSuggestion,
} from '../lib/labelSearch';

interface Props {
  labels: Label[];
  /** The ids this task carries. */
  worn: string[];
  /**
   * By name rather than by id, so one path covers both halves of the box: an
   * existing label and a new one are the same gesture, and only the store
   * needs to know which it turned out to be. Takes a list because a paste can
   * finish several at once, and applying them one at a time would race.
   */
  onWear: (names: string[]) => void;
  onTakeOff: (labelId: string) => void;
}

/**
 * Search and create in one box — type to narrow, Enter to take, comma to move
 * on to the next one.
 *
 * It replaced a wall of every label as a toggle, which answers "which are on"
 * beautifully at five labels and not at all at fifty. The chips above the box
 * keep that answer; the box itself is for the far commoner case of knowing
 * what you want and typing three letters of it.
 */
export function LabelPicker({ labels, worn, onWear, onTakeOff }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const carried = labels.filter((l) => worn.includes(l.id)).sort(byLabelOrder);
  const suggestions = suggestLabels(labels, worn, query);
  const showing = open && suggestions.length > 0;
  const highlighted = Math.min(active, suggestions.length - 1);

  const take = (suggestion: LabelSuggestion) => {
    onWear([suggestion.kind === 'create' ? suggestion.name : suggestion.label.name]);
    setQuery('');
    setActive(0);
  };

  const typed = (value: string) => {
    const { commit, rest } = splitLabelInput(value);
    if (commit.length > 0) onWear(commit);
    setQuery(rest);
    setActive(0);
    setOpen(true);
  };

  const key = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive((a) => Math.min(a + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const picked = suggestions[highlighted];
        if (picked) {
          take(picked);
        } else if (query.trim() !== '') {
          // The only way to type something with nothing to offer is to name a
          // label the task already wears — there is always either a match or
          // the offer to create one. Asking for what you already have is
          // answered by clearing the box, not by leaving dead text in it.
          setQuery('');
          setActive(0);
        }
        break;
      }
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
      case 'Backspace':
        // The standard escape hatch: with nothing left to delete in the box,
        // the next backspace takes the last thing you added.
        if (query === '' && carried.length > 0) onTakeOff(carried[carried.length - 1]!.id);
        break;
    }
  };

  return (
    <fieldset className="field label-search">
      <legend>Labels</legend>

      {carried.length > 0 && (
        <ul className="label-search__worn">
          {carried.map((label) => (
            <li key={label.id} className="label-worn" data-color={label.colorId}>
              {label.name}
              <button
                type="button"
                className="label-worn__off"
                aria-label={`Take off label ${label.name}`}
                onClick={() => onTakeOff(label.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        value={query}
        onChange={(event) => typed(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={key}
        placeholder="Search or add a label"
        aria-label="Search or add a label"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-activedescendant={showing ? `${listId}-${highlighted}` : undefined}
        aria-autocomplete="list"
      />

      {/*
        In the flow rather than floating over what follows. A panel that
        scrolls makes an overlay fiddly on a phone, and an overlay needs a
        background to hide what's under it — which is exactly the kind of thing
        that stops working the moment a theme file is missing. Pushing the
        fields down is honest, bounded by a max height, and needs no paint.

        The options are `li`s and not buttons because this is a combobox: the
        input keeps focus throughout and drives the list with the arrow keys,
        which is the whole keyboard story. A focusable button in each row would
        add a second, worse one.
      */}
      {showing && (
        <ul className="label-search__options" id={listId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.kind === 'create' ? 'create' : suggestion.label.id}
              id={`${listId}-${index}`}
              className="label-search__option"
              role="option"
              aria-selected={index === highlighted}
              data-color={suggestion.kind === 'existing' ? suggestion.label.colorId : undefined}
              // Keeps the caret in the box: a blur would close the list out
              // from under the click that is trying to land on it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => take(suggestion)}
            >
              {suggestion.kind === 'existing' ? (
                <>
                  <span className="label-chip" aria-hidden="true" />
                  {suggestion.label.name}
                </>
              ) : (
                <>
                  <span className="label-search__new">New</span>
                  {suggestion.name}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
