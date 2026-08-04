import type { RouteView } from '../lib/route';
import type { Project } from '../types/task';
import { toClock } from '../lib/time';
import { PointNode } from './PointNode';
import { RestNode } from './RestNode';
import { MomentumOffer } from './MomentumOffer';

interface Props {
  route: RouteView;
  endsAt: number;
  /** The point holding an open offer, if any. */
  offerFor: string | null;
  projects: Project[];
  onStart: (id: string) => void;
  onClear: (id: string) => void;
  onLog: (id: string) => void;
  onUnlog: (id: string) => void;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
}

/**
 * The route as a place you run, not a thing you arrange.
 *
 * Every control here either does something or records that something was done.
 * Nothing adds, removes or reorders — that moved to the workshop, because
 * re-deciding the plan while standing on it is the failure this app is built
 * to route around.
 */
export function PathView({
  route,
  endsAt,
  offerFor,
  projects,
  onStart,
  onClear,
  onLog,
  onUnlog,
  onAcceptOffer,
  onDeclineOffer,
}: Props) {
  let ordinal = 0;

  return (
    <ol className="path">
      {route.segments.map((segment) => {
        if (segment.kind === 'rest') {
          return <RestNode key={segment.rest.id} view={segment} />;
        }

        ordinal += 1;
        const showOffer = offerFor === segment.point.id && route.upNext !== null;

        return (
          <PointNode
            key={segment.point.id}
            view={segment}
            ordinal={ordinal}
            project={projects.find((p) => p.id === segment.point.projectId)}
            onStart={onStart}
            onClear={onClear}
            onLog={onLog}
            onUnlog={onUnlog}
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
