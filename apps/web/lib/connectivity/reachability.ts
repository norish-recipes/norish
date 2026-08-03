/**
 * The Reachability Deadline (CONTEXT.md): the single bounded wait after which
 * the backend counts as unreachable for the attempt at hand. The health probe
 * and the service worker's document-navigation handler observe the same
 * deadline, so "the backend is unreachable" means one thing everywhere
 * (ADR-0013).
 *
 * Kept in its own module because the service worker imports it too — pulling
 * probe.ts into the SW bundle would drag window-flavored code along.
 */
export const REACHABILITY_DEADLINE_MS = 5_000;
