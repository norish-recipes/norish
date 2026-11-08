"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserStorage } from "@/lib/browser-storage";
import { showActionToast } from "@/lib/ui/action-toast";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PlatformAdapter } from "@norish/shared-react/platform";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";
import { PlatformProvider } from "@norish/shared-react/platform";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

/** The web's platform adapter. `deviceKind` is the request's; an Offline start-up has none. */
export function WebPlatformProvider({
  deviceKind,
  children,
}: {
  deviceKind?: DeviceKind;
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
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}
