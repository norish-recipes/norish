import type { Timer } from "@norish/shared-react/recipes/timers";
import { addBasePath } from "@norish/shared/lib/base-path";
import { createClientLogger } from "@norish/shared/lib/logger";

const logger = createClientLogger("timers");

/** Shows a finished timer's OS notification through the service worker while the page is hidden. */
export function showTimerNotification(
  timer: Pick<Timer, "label" | "recipeName">,
  body: string
): void {
  // Audio still plays in the foreground where notifications are unavailable.
  if (
    typeof document === "undefined" ||
    !document.hidden ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      const title = timer.recipeName ? `${timer.label} — ${timer.recipeName}` : timer.label;

      return registration.showNotification(title, {
        body,
        icon: addBasePath("/brand/icon-192.png"),
        tag: "timer-complete",
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
      } as NotificationOptions);
    })
    .catch((err) => {
      logger.warn(err, "Failed to show timer notification");
    });
}
