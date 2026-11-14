import { useEffect, useSyncExternalStore } from "react";
import { planTimerNotifications } from "@/lib/timer-notifications";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useTimersEnabledQuery } from "@norish/shared-react/config";
import { timerEndsAt, useTimerStore, useTimerTicker } from "@norish/shared-react/recipes/timers";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("recipe-timers");

// A timer's notification shows over the app too, with its sound: the app has no ring of its own.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

/** Where a timer's notification and its Live Activity open: cook mode on the timer's step. */
export const cookModeRoute = (recipeId: string, step: number) =>
  ({ pathname: "/recipe/[id]/cook", params: { id: recipeId, step: String(step) } }) as const;

let answers = 0;
const answerListeners = new Set<() => void>();

/** Asks for notification permission the first time a timer starts; a refusal leaves the timer running. */
export async function askTimerNotifications(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();

    if (current.granted || !current.canAskAgain) return;
    await Notifications.requestPermissionsAsync();
    answers += 1;
    answerListeners.forEach((listener) => listener());
  } catch (error) {
    log.warn({ error }, "Could not ask for notification permission");
  }
}

let syncing = Promise.resolve();

/** Schedules and cancels so the pending notifications match the store's running timers. */
async function syncTimerNotifications(body: string): Promise<void> {
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

/** Keeps one pending notification per running timer at its end, rescheduled on every change. */
function useTimerNotifications() {
  const intl = useIntl();
  // Ticks leave each running timer's end unchanged, so this changes only on start, pause, adjust and the rest.
  const shape = useTimerStore((state) =>
    state.timers.map((timer) => `${timer.id}:${timer.status}:${timerEndsAt(timer)}`).join("|")
  );
  const answered = useSyncExternalStore(
    (listener) => {
      answerListeners.add(listener);

      return () => void answerListeners.delete(listener);
    },
    () => answers
  );
  const body = intl.formatMessage({ id: "common.timer.notification_body" });

  useEffect(() => {
    // One sync at a time, so two quick changes never schedule the same timer twice.
    syncing = syncing.then(() => syncTimerNotifications(body));
  }, [shape, answered, body]);
}

const opened = new Set<string>();

/** A tapped timer notification opens cook mode on its step, from a cold start too. */
export function useTimerNotificationTaps() {
  const router = useRouter();

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const { identifier, content } = response.notification.request;
      const recipeId = content.data?.recipeId;
      const step = content.data?.step;

      // The launch response is also replayed to the listener, so each tap opens once.
      if (
        opened.has(identifier) ||
        response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
      )
        return;
      if (typeof recipeId !== "string") return;
      opened.add(identifier);
      router.push(cookModeRoute(recipeId, typeof step === "number" ? step : 0));
    };
    const launch = Notifications.getLastNotificationResponse();

    if (launch) open(launch);

    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    return () => subscription.remove();
  }, [router]);
}

/** The device's Recipe Timers, mounted once while signed in: ticking, notifying and opening. */
export function useRecipeTimers() {
  const { timersEnabled } = useTimersEnabledQuery();
  const clearAll = useTimerStore((state) => state.clearAll);
  const hasTimers = useTimerStore((state) => state.timers.length > 0);

  useTimerTicker({
    finished: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  });
  useTimerNotifications();
  useTimerNotificationTaps();

  // Hidden timers start nothing, and the ones running when they were hidden stop, as on web.
  useEffect(() => {
    if (!timersEnabled && hasTimers) clearAll();
  }, [timersEnabled, hasTimers, clearAll]);
}
