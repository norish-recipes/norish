"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

const logger = createClientLogger("notification-permission");

interface UseNotificationPermissionReturn {
  /** Whether the Notification API is supported in this browser */
  isSupported: boolean;
  /** Current permission state: 'granted', 'denied', or 'default' */
  permission: NotificationPermission | "unsupported";
  /** Whether notifications are granted */
  isGranted: boolean;
  /** Whether notifications are denied */
  isDenied: boolean;
  /** Request notification permission from the user */
  requestPermission: () => Promise<NotificationPermission | "unsupported">;
}

const noSubscription = () => () => {};

function readPermission(): NotificationPermission | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export function useNotificationPermission(): UseNotificationPermissionReturn {
  // Browser support and current permission: "unsupported" on the server and
  // while hydrating, like the markup the server sent.
  const browserPermission = useSyncExternalStore<NotificationPermission | "unsupported">(
    noSubscription,
    readPermission,
    () => "unsupported"
  );
  const [requested, setRequested] = useState<NotificationPermission | null>(null);
  const isSupported = browserPermission !== "unsupported";
  const permission = requested ?? browserPermission;

  const requestPermission = useCallback(async (): Promise<
    NotificationPermission | "unsupported"
  > => {
    if (!isSupported) {
      logger.warn("Notification API is not supported in this browser");

      return "unsupported";
    }

    // Already granted or denied — no need to prompt
    if (Notification.permission !== "default") {
      setRequested(Notification.permission);

      return Notification.permission;
    }

    try {
      const result = await Notification.requestPermission();

      setRequested(result);
      logger.info(`Notification permission: ${result}`);

      return result;
    } catch (err) {
      logger.error(err, "Failed to request notification permission");

      return Notification.permission;
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isGranted: permission === "granted",
    isDenied: permission === "denied",
    requestPermission,
  };
}
