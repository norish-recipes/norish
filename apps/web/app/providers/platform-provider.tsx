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

import type { PlatformAdapter, PlatformSession, SignOut } from "@norish/shared-react/platform";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";
import { PlatformProvider } from "@norish/shared-react/platform";
import { signOut as betterAuthSignOut } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

/** Whether better-auth signed the reader out; a failure (e.g. Offline) leaves everything as it was. */
async function authSignedOut(): Promise<boolean> {
  try {
    const result = await betterAuthSignOut();

    return !(result && typeof result === "object" && "error" in result && result.error);
  } catch {
    return false;
  }
}

// The offline engine is cleared only once the auth sign-out succeeded (ADR-0009).
const signOut: SignOut = async (options) => {
  if (!(await authSignedOut())) return;

  await offlineEngine.clearForSignOut({ discardQueue: options?.discardQueue ?? false });
  window.location.href = addBasePath("/login?logout=true");
};

const SIGNED_OUT: PlatformSession = { user: null, isPending: false };

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
      show: ({ severity, title, description, actionLabel, onActionPress }) => {
        if (actionLabel) {
          showActionToast(title, {
            description,
            variant: severity,
            action: { label: actionLabel, onPress: () => onActionPress?.() },
          });

          return;
        }

        toast(title, { description, variant: severity });
      },
      translate: (messageId, values) => t(messageId as Parameters<typeof t>[0], values),
    },
    navigation: {
      toHome: () => router.push("/"),
      toRecipe: (id) => router.push(`/recipes/${id}`),
    },
    showError: (error, context) =>
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        error,
        context,
      }),
    storage: browserStorage,
    deviceKind: kind,
    session,
    signOut,
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}
