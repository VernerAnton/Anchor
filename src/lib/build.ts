import { MONTH_NAMES, pad } from './dates';
import { APP_VERSION } from '../version';

/**
 * Which build is this, as display-ready data.
 *
 * The values arrive as string literals substituted at build time (see the
 * `define` block in vite.config.ts), so this does no work beyond formatting —
 * the component receives a finished label and renders it.
 *
 * The point of showing it at all: a service worker can keep serving an old
 * build after a new one deploys, and this app is installed as a PWA on several
 * devices. A visible stamp turns "is this device stale?" from a guess into a
 * glance.
 *
 * The version leads because it is the part a person can actually compare
 * between two devices; the sha and build time are the forensics behind it and
 * live in the hover detail.
 */

/** The branch whose builds are the real thing; not worth naming in the label. */
const PRODUCTION_REF = 'main';

export interface BuildInfo {
  sha: string;
  ref: string;
  /** Short, for the sidebar — the version, and nothing else. */
  label: string;
  /** Long, for the hover title. */
  detail: string;
}

function formatTime(iso: string): string {
  const built = new Date(iso);
  if (Number.isNaN(built.getTime())) return '';
  const month = MONTH_NAMES[built.getMonth()] ?? '';
  return `${built.getDate()} ${month} ${pad(built.getHours())}:${pad(built.getMinutes())}`;
}

export function buildInfo(): BuildInfo {
  const sha = __BUILD_SHA__;
  const ref = __BUILD_REF__;
  const time = formatTime(__BUILD_TIME__);

  // The branch earns a place in the detail only when it isn't production —
  // which is exactly when you're looking at a preview and need to know.
  const branch = ref && ref !== PRODUCTION_REF ? ` on ${ref}` : '';

  return {
    sha,
    ref,
    label: `V${APP_VERSION}`,
    detail: [`V${APP_VERSION}`, `build ${sha}${branch}`, time].filter(Boolean).join(' · '),
  };
}
