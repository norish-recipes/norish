"use client";

import { useEffect, useState, useCallback } from "react";

import { createClientLogger } from "@/lib/logger";

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

export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );

  // Check browser support and current permission on mount
  useEffect(() => {
    const supported = "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<
    NotificationPermission | "unsupported"
  > => {
    if (!isSupported) {
      logger.warn("Notification API is not supported in this browser");

      return "unsupported";
    }

    // Already granted or denied — no need to prompt
    if (Notification.permission !== "default") {
      setPermission(Notification.permission);

      return Notification.permission;
    }

    try {
      const result = await Notification.requestPermission();

      setPermission(result);
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
