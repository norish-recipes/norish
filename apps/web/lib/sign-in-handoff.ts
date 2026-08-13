/**
 * Signing in hands over to the app instead of cutting to it.
 *
 * Credential sign-in stays inside the document, so the client-side navigation
 * is wrapped in a view transition: the card and its drawings settle out and
 * the app shell arrives as one continuous movement. Provider sign-in leaves
 * the whole document for the identity provider and returns as a cold load, so
 * there is no outgoing page to transition from — that route gets the arrival
 * half only, carried across the round trip in sessionStorage.
 *
 * Either way the app shell plays a one-off entrance on its first
 * authenticated paint, keyed off a just-arrived signal that is read once and
 * cleared, so ordinary navigation afterwards is not animated and a refresh
 * does not replay it. Reduced motion stands the whole hand-off down, and a
 * browser without view-transition support signs in with a plain navigation.
 */

const JUST_ARRIVED_STORAGE_KEY = "norish:just-arrived";

/** Set on <html> while the app shell's one-off entrance should play. */
export const APP_ARRIVAL_ATTRIBUTE = "data-app-arrival";

/** Comfortably past the entrance animation before the attribute is dropped. */
export const APP_ARRIVAL_DURATION_MS = 700;

/**
 * Reads the just-arrived signal exactly once, before first paint: a cold
 * load that carries it (the provider round trip) clears it and marks the
 * document so the entrance CSS applies from the very first frame.
 */
export const CONSUME_ARRIVAL_SIGNAL_SCRIPT = `try{if(sessionStorage.getItem("${JUST_ARRIVED_STORAGE_KEY}")){sessionStorage.removeItem("${JUST_ARRIVED_STORAGE_KEY}");document.documentElement.setAttribute("${APP_ARRIVAL_ATTRIBUTE}","")}}catch(e){}`;

/**
 * A failed or abandoned provider redirect lands back on an auth page with
 * the signal still set; the auth layout clears it so the next visit to the
 * app does not replay an arrival nobody just made.
 */
export const CLEAR_STALE_ARRIVAL_SCRIPT = `try{sessionStorage.removeItem("${JUST_ARRIVED_STORAGE_KEY}")}catch(e){}`;

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => unknown;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Provider sign-in navigates the document away, so the arrival signal rides
 * sessionStorage across the round trip. Storage being unavailable only costs
 * the entrance — the sign-in itself proceeds.
 */
export function markArrivalForRedirect(): void {
  try {
    window.sessionStorage.setItem(JUST_ARRIVED_STORAGE_KEY, "1");
  } catch {
    // Arrive plainly.
  }
}

let pendingCommit: (() => void) | null = null;

/** Called by the root-level watcher once the route has actually changed. */
export function commitHandoffNavigation(): void {
  pendingCommit?.();
  pendingCommit = null;
}

/**
 * Hands a successful credential sign-in over to the app. The navigation is
 * wrapped in a view transition whose update settles when the new route has
 * committed; a capped wait keeps the page from freezing should the
 * navigation never land.
 */
export function handOverToApp(navigate: () => void): void {
  const doc = document as DocumentWithViewTransition;

  if (prefersReducedMotion()) {
    navigate();

    return;
  }

  // The entrance keys off the document, not storage: within one document the
  // arriving shell can be marked directly.
  document.documentElement.setAttribute(APP_ARRIVAL_ATTRIBUTE, "");

  if (!doc.startViewTransition) {
    navigate();

    return;
  }

  doc.startViewTransition(() => {
    navigate();

    return new Promise<void>((resolve) => {
      pendingCommit = resolve;
      setTimeout(resolve, 1500);
    });
  });
}
