import type { RouteView } from '../lib/route';
import { toClock } from '../lib/time';
import { PointNode } from './PointNode';
import { RestNode } from './RestNode';
import { MomentumOffer } from './MomentumOffer';
import { SegmentTools } from './SegmentTools';

interface Props {
  route: RouteView;
  endsAt: number;
  /** The point holding an open offer, if any. */
  offerFor: string | null;
  editing: boolean;
  onStart: (id: string) => void;
  onClear: (id: string) => void;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
  onEditSegment: (id: string) => void;
  onMoveSegment: (id: string, direction: -1 | 1) => void;
  onRemoveSegment: (id: string) => void;
}

export function PathView({
  route,
  endsAt,
  offerFor,
  editing,
  onStart,
  onClear,
  onAcceptOffer,
  onDeclineOffer,
  onEditSegment,
  onMoveSegment,
  onRemoveSegment,
}: Props) {
  let ordinal = 0;

  const toolsFor = (id: string) =>
    editing ? (
      <SegmentTools
        onEdit={() => onEditSegment(id)}
        onMoveUp={() => onMoveSegment(id, -1)}
        onMoveDown={() => onMoveSegment(id, 1)}
        onRemove={() => onRemoveSegment(id)}
      />
    ) : undefined;

  return (
    <ol className="path">
      {route.segments.map((segment) => {
        if (segment.kind === 'rest') {
          return (
            <RestNode key={segment.rest.id} view={segment} tools={toolsFor(segment.rest.id)} />
          );
        }

        ordinal += 1;
        const showOffer = offerFor === segment.point.id && route.upNext !== null;

        return (
          <PointNode
            key={segment.point.id}
            view={segment}
            ordinal={ordinal}
            onStart={onStart}
            onClear={onClear}
            editing={editing}
            tools={toolsFor(segment.point.id)}
          >
            {showOffer && route.upNext && (
              <MomentumOffer
                next={route.upNext}
                onAccept={onAcceptOffer}
                onDecline={onDeclineOffer}
              />
            )}
          </PointNode>
        );
      })}

      {/*
        Not a task, and not something you can fall short of. The path is
        finite by design and stops pushing here — what happens after this is
        unscheduled on purpose.
      */}
      <li className="n next">
        <span className="t">{toClock(endsAt)}</span>
        <span className="pip" aria-hidden="true" />
        <div className="card">
          <div className="tag">
            <span>END OF ROUTE</span>
            <b>OPEN</b>
          </div>
          <div className="act">The path stops here</div>
          <div className="dur">UNSCHEDULED · YOURS</div>
        </div>
      </li>
    </ol>
  );
}
