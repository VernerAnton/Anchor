/**
 * The app's version, as a plain counter.
 *
 * Deliberately hand-maintained rather than derived from git: a version should
 * mark a change worth noticing, not every commit. It exists so a device can be
 * checked at a glance — the commit sha is precise but unreadable across four
 * installed copies of the app, and "am I on the current build?" is a question
 * that has to be answerable in a second.
 *
 * **Bump this by one whenever work ships to main.**
 */
export const APP_VERSION = 12;
