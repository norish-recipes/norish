import type { Timer } from "@norish/shared-react/recipes/timers";
import { timerEndsAt } from "@norish/shared-react/recipes/timers";

const PREFIX = "timer:";

/** A finished timer's notification this close to its end is firing now, so it is left alone. */
const FIRING_GRACE_MS = 2000;

/** A timer's notification is named by its timer and its end, so a new end is a new notification. */
export const timerNotificationId = (timerId: string, endsAt: number) =>
  `${PREFIX}${timerId}@${endsAt}`;

function parseId(identifier: string): { timerId: string; endsAt: number } | null {
  const at = identifier.lastIndexOf("@");

  if (!identifier.startsWith(PREFIX) || at < 0) return null;

  return { timerId: identifier.slice(PREFIX.length, at), endsAt: Number(identifier.slice(at + 1)) };
}

/**
 * What to schedule and cancel so the pending notifications match the timers: one per running timer
 * at its end. Pause, reset and removal drop it; adjust and resume replace it with the new end.
 */
export function planTimerNotifications(
  timers: readonly Timer[],
  scheduled: readonly string[],
  now: number
): { cancel: string[]; schedule: { identifier: string; timer: Timer; endsAt: number }[] } {
  const byId = new Map(timers.map((timer) => [timer.id, timer]));
  const wanted = timers.flatMap((timer) => {
    const endsAt = timerEndsAt(timer);

    return endsAt !== null && endsAt > now
      ? [{ identifier: timerNotificationId(timer.id, endsAt), timer, endsAt }]
      : [];
  });
  const wantedIds = new Set(wanted.map((entry) => entry.identifier));
  const cancel = scheduled.filter((identifier) => {
    const parsed = parseId(identifier);

    if (!parsed || wantedIds.has(identifier)) return false;

    // The tick may mark a timer done a moment before the system delivers its notification.
    const firing =
      byId.get(parsed.timerId)?.status === "completed" && parsed.endsAt <= now + FIRING_GRACE_MS;

    return !firing;
  });
  const pending = new Set(scheduled);

  return { cancel, schedule: wanted.filter((entry) => !pending.has(entry.identifier)) };
}
