interface Props {
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

/**
 * Edit controls, shown only while editing.
 *
 * They live outside the card rather than inside it so that nothing about a
 * node's normal appearance changes when editing is switched on — the path you
 * walk and the path you arrange stay recognisably the same object.
 */
export function SegmentTools({ onEdit, onMoveUp, onMoveDown, onRemove }: Props) {
  return (
    <div className="tools">
      <button type="button" onClick={onEdit}>
        Edit
      </button>
      <button type="button" onClick={onMoveUp} aria-label="Move earlier">
        ▲
      </button>
      <button type="button" onClick={onMoveDown} aria-label="Move later">
        ▼
      </button>
      <button type="button" className="drop" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
