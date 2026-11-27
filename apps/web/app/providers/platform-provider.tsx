"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserStorage } from "@/lib/browser-storage";
import { offlineEngine } from "@/lib/offline/engine";
import { showActionToast } from "@/lib/ui/action-toast";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type {
  LeaveReason,
  PlatformAdapter,
  PlatformSession,
  SessionScope,
} from "@norish/shared-react/platform";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";
import { PlatformProvider } from "@norish/shared-react/platform";
import { connectTimerStorage } from "@norish/shared-react/recipes/timers";
import { signOut } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";
import { isOpenableExternalUrl } from "@norish/shared/lib/external-url";

const SIGNED_OUT: PlatformSession = { user: null, isPending: false };

// On import, as the store once read localStorage itself; the server keeps no timers.
if (typeof window !== "undefined") connectTimerStorage(browserStorage);

let navigatedToLogin = false;

/**
 * Sign-in once per page: a late 401 after a sign-out cannot replace its destination.
 * `logout=true` stops a lone OAuth provider's redirect, which could recreate a deleted Account.
 */
export function leaveToLogin(reason: LeaveReason): void {
  if (navigatedToLogin) return;
  navigatedToLogin = true;

  const url = new URL(addBasePath("/login"), window.location.origin);

  if (reason === "sign-out") url.searchParams.set("logout", "true");
  else url.searchParams.set("callbackUrl", window.location.pathname + window.location.search);
  window.location.assign(url.toString());
}

/**
 * Fails while Offline: the cookie is httpOnly, so only the server can end the session.
 * On this device alone there is nothing to drop, and a passing 401 must not end a live session.
 */
export async function endWebSession(scope: SessionScope): Promise<void> {
  if (scope === "device") return;

  const { error } = await signOut();

  if (error) throw new Error(error.message ?? `Sign-out failed: ${error.status}`);
}

/**
 * The web's platform adapter. `deviceKind` is the request's; an Offline start-up has none.
 * `session` comes from the signed-in shell; login and share pages read no session.
 */
export function WebPlatformProvider({
  deviceKind,
  session = SIGNED_OUT,
  children,
}: {
  deviceKind?: DeviceKind;
  session?: PlatformSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations();
  const tErrors = useTranslations("common.errors");
  const [kind] = useState<DeviceKind>(
    () =>
      deviceKind ??
      deviceKindFromUserAgent(typeof navigator === "undefined" ? null : navigator.userAgent)
  );

  const adapter: PlatformAdapter = {
    toast: {
      show: ({ severity, title, description, actionLabel, onActionPress, persistent }) => {
        // A timeout of 0 keeps the toast until it is dismissed or its action is pressed.
        const timeout = persistent ? 0 : undefined;

        if (actionLabel) {
          showActionToast(title, {
            description,
            variant: severity,
            timeout,
            action: { label: actionLabel, onPress: () => onActionPress?.() },
          });

          return;
        }

        toast(title, { description, variant: severity, timeout });
      },
      translate: (messageId, values) => t(messageId as Parameters<typeof t>[0], values),
    },
    navigation: {
      toHome: () => router.push("/"),
      toRecipe: (id) => router.push(`/recipes/${id}`),
    },
    showError: (error, context, title) =>
      showSafeErrorToast({
        title: title ?? tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        error,
        context,
      }),
    storage: browserStorage,
    // A browser opens a tab for a few seconds after a press, so a link that comes back from an
    // async call usually still opens; one that blocks it says so with a null window. `noopener`
    // would make every open answer null, so the tab's link back to this page is cut by hand,
    // while the tab is still the blank one the browser creates first.
    openExternalUrl: (url) => {
      if (!isOpenableExternalUrl(url)) return false;

      const opened = window.open(url, "_blank");

      if (!opened) return false;
      opened.opener = null;

      return true;
    },
    supportsExternalShoppingList: true,
    deviceKind: kind,
    session,
    endSession: endWebSession,
    leave: leaveToLogin,
    offlineEngine,
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}
