import * as Notifications from "expo-notifications";

import { createClientLogger } from "@norish/shared/lib/logger";

const logger = createClientLogger("timer-notifications");

// ─── Foreground handler ──────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Show / dismiss ──────────────────────────────────────────────────────────

export async function showTimerNotification(timer: {
  label: string;
  recipeName?: string;
}): Promise<void> {
  try {
    const title = timer.recipeName ? `${timer.label} — ${timer.recipeName}` : timer.label;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: "Timer complete!",
        sound: "default",
        categoryIdentifier: "timer-complete",
      },
      trigger: null,
    });
  } catch (err) {
    logger.warn(err, "Failed to show timer notification");
  }
}

export async function dismissAllTimerNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (err) {
    logger.warn(err, "Failed to dismiss notifications");
  }
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
