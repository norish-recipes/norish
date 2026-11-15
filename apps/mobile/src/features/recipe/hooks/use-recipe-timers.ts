import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { cookModeRoute } from "@/lib/cook-mode-route";
import { syncTimers } from "@/lib/timer-notifications";
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

/** Keeps one pending notification per running timer and the Live Activity in step with every change. */
function useTimerNotifications() {
  const intl = useIntl();
  // A tick moves neither a running timer's end nor a stopped one's time; start, pause, reset, adjust and finish do.
  const shape = useTimerStore((state) =>
    state.timers
      .map((timer) => `${timer.id}:${timer.status}:${timerEndsAt(timer) ?? timer.remainingMs}`)
      .join("|")
  );
  const answered = useSyncExternalStore(
    (listener) => {
      answerListeners.add(listener);

      return () => void answerListeners.delete(listener);
    },
    () => answers
  );
  const body = intl.formatMessage({ id: "common.timer.notification_body" });
  const paused = intl.formatMessage({ id: "common.timer.paused" });
  const done = intl.formatMessage({ id: "common.timer.done" });
  const strings = {
    body,
    paused,
    done,
    more: (count: number) => intl.formatMessage({ id: "common.timer.more" }, { count }),
  };

  const sync = useEffectEvent(() => void syncTimers(strings));

  useEffect(() => sync(), [shape, answered, body, paused, done]);

  // A grant in Settings arrives with no event, so a return to the foreground syncs again.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => subscription.remove();
  }, []);
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

  useTimerTicker(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  useTimerNotifications();
  useTimerNotificationTaps();

  // Hidden timers start nothing, and the ones running when they were hidden stop, as on web.
  useEffect(() => {
    if (!timersEnabled && hasTimers) clearAll();
  }, [timersEnabled, hasTimers, clearAll]);
}
