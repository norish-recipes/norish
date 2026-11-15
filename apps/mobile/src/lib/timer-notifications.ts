import * as Notifications from "expo-notifications";

import type { Timer } from "@norish/shared-react/recipes/timers";
import { runningTimers, useTimerStore } from "@norish/shared-react/recipes/timers";
import { createClientLogger } from "@norish/shared/lib/logger";

import type { TimerStrings } from "./timer-activity-state";
import { syncTimerActivity } from "./timer-activity";
import { timerActivityPlan } from "./timer-activity-state";

const log = createClientLogger("recipe-timers");

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

/** What to cancel and schedule so each running timer has one pending notification, at its end. */
export function planTimerNotifications(
  timers: readonly Timer[],
  scheduled: readonly string[],
  now: number
): { cancel: string[]; schedule: { identifier: string; timer: Timer; endsAt: number }[] } {
  const byId = new Map(timers.map((timer) => [timer.id, timer]));
  const wanted = runningTimers(timers, now).map(({ timer, endsAt }) => ({
    identifier: timerNotificationId(timer.id, endsAt),
    timer,
    endsAt,
  }));
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

// One sync or end at a time, so two quick changes never schedule a timer twice and an end follows any sync.
let syncing = Promise.resolve();

/** Runs `step` after the queued ones; a failure is logged, so it never stops the next. */
function queue(step: () => Promise<void>): Promise<void> {
  syncing = syncing
    .then(step)
    .catch((error: unknown) => log.warn({ error }, "Could not sync the Recipe Timers"));

  return syncing;
}

/** Brings the pending notifications and the Live Activity in line with the store's timers. */
export function syncTimers(strings: TimerStrings): Promise<void> {
  return queue(async () => {
    await syncNotifications(strings.body);
    await syncTimerActivity(
      timerActivityPlan(useTimerStore.getState().timers, Date.now(), strings)
    );
  });
}

async function syncNotifications(body: string): Promise<void> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const { cancel, schedule } = planTimerNotifications(
      useTimerStore.getState().timers,
      pending.map((request) => request.identifier),
      Date.now()
    );

    await Promise.all(
      cancel.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier))
    );
    // Without permission the system refuses them; the answer to the first ask syncs again.
    if (schedule.length === 0 || !(await Notifications.getPermissionsAsync()).granted) return;
    await Promise.all(
      schedule.map(({ identifier, timer, endsAt }) =>
        Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: timer.recipeName ? `${timer.label} — ${timer.recipeName}` : timer.label,
            body,
            sound: "default",
            data: { recipeId: timer.recipeId, step: timer.stepIndex ?? 0 },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt },
        })
      )
    );
  } catch (error) {
    log.warn({ error }, "Could not schedule timer notifications");
  }
}

/** Recipe Timers belong to the session: its end drops them, their notifications, the last tap and the Live Activity. */
export function endRecipeTimers(): Promise<void> {
  useTimerStore.getState().clearAll();
  Notifications.clearLastNotificationResponse();

  return queue(async () => {
    await Promise.all([cancelTimerNotifications(), syncTimerActivity({ kind: "end" })]);
  });
}

async function cancelTimerNotifications(): Promise<void> {
  const [scheduled, presented] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync(),
    Notifications.getPresentedNotificationsAsync(),
  ]);

  await Promise.all([
    ...scheduled
      .filter(({ identifier }) => identifier.startsWith(PREFIX))
      .map(({ identifier }) => Notifications.cancelScheduledNotificationAsync(identifier)),
    ...presented
      .filter(({ request }) => request.identifier.startsWith(PREFIX))
      .map(({ request }) => Notifications.dismissNotificationAsync(request.identifier)),
  ]);
}
