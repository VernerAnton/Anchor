import type { GroupBy, SortBy, ViewOptions } from '../types/settings';
import type { ListOptionsModel } from '../lib/views';
import { SORT_OPTIONS } from '../lib/sorting';
import { GROUP_OPTIONS } from '../lib/grouping';

interface Props {
  options: ListOptionsModel;
  onChange(changes: Partial<ViewOptions>): void;
}

/**
 * How this list sorts and groups — remembered per view, and synced. Native
 * controls throughout, so the current choice reads with any theme or none.
 */
export function ViewOptionsBar({ options, onChange }: Props) {
  return (
    <div className="view-options" role="group" aria-label="Arrange this list">
      <label className="view-options__field">
        <span className="view-options__label">Sort</span>
        <select
          className="text-input view-options__select"
          value={options.sortBy}
          onChange={(event) => onChange({ sortBy: event.target.value as SortBy })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="view-options__field view-options__check">
        <input
          type="checkbox"
          checked={options.reverse}
          onChange={(event) => onChange({ reverse: event.target.checked })}
        />
        Reverse
      </label>
      {options.groupable && (
        <label className="view-options__field">
          <span className="view-options__label">Group</span>
          <select
            className="text-input view-options__select"
            value={options.groupBy}
            onChange={(event) => onChange({ groupBy: event.target.value as GroupBy })}
          >
            {GROUP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
