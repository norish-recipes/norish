import type { ReactNode } from "react";
import { use } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { publishSignedOut } from "@/lib/auth/auth-session-sync";
import { ServerAddressContext } from "@/lib/network/server-address";
import { offlineEngine } from "@/lib/offline/engine";
import { storage } from "@/lib/storage/mmkv";
import { useRouter } from "expo-router";
import { useToast } from "heroui-native";
import { useIntl } from "react-intl";

import type {
  PlatformAdapter,
  PlatformSession,
  PlatformStorage,
} from "@norish/shared-react/platform";
import { createIntlMessageTranslator } from "@norish/i18n";
import { PlatformProvider } from "@norish/shared-react/platform";
import { createClientLogger } from "@norish/shared/lib/logger";

import type { ToastSeverity } from "./app-toast";
import { AppToast } from "./app-toast";
import { mobileToastDescription } from "./toast-description";

const log = createClientLogger("mobile-platform");

// ponytail: iPads count as desktops like iPad Safari; Android tablets stay phones until expo-device.
const deviceKind = Platform.OS === "ios" && Platform.isPad ? "desktop" : "phone";

const mmkvStorage: PlatformStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => {
    storage.remove(key);
  },
};

/** The mobile app's platform adapter: heroui-native toasts, Expo Router, MMKV and the session. */
export function MobilePlatformProvider({
  children,
  endSession,
  session,
}: {
  children: ReactNode;
  endSession: PlatformAdapter["endSession"];
  session: PlatformSession;
}) {
  const intl = useIntl();
  const { toast } = useToast();
  const router = useRouter();
  const serverAddress = use(ServerAddressContext);

  // An action toast stays long enough to reach its button; web's 4 s pause on hover has no touch twin.
  const showToast = (content: {
    severity: ToastSeverity;
    title: string;
    body?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    toast.show({
      duration: content.actionLabel ? 8000 : 4000,
      component: (props) => <AppToast {...props} {...content} />,
    });
    AccessibilityInfo.announceForAccessibility(
      content.body ? `${content.title}, ${content.body}` : content.title
    );
  };

  const adapter: PlatformAdapter = {
    toast: {
      show: ({ severity, title, description, subject, actionLabel, onActionPress }) =>
        showToast({
          severity,
          title,
          body:
            mobileToastDescription(
              description,
              intl.formatMessage({ id: "common.errors.technicalDetails" })
            ) ?? subject,
          actionLabel,
          onAction: onActionPress,
        }),
      translate: createIntlMessageTranslator(intl.formatMessage),
    },
    navigation: {
      toHome: () => router.replace("/"),
      toRecipe: (id) => router.push({ pathname: "/recipe/[id]", params: { id } }),
    },
    showError: (error, context, title) => {
      log.error({ error }, context);
      showToast({
        severity: "danger",
        title: title ?? intl.formatMessage({ id: "common.errors.operationFailed" }),
        body: error instanceof Error ? error.message : String(error),
      });
    },
    storage: mmkvStorage,
    deviceKind,
    session,
    endSession,
    // After the clear: the session reads pending until this, so the sign-in stack mounts on the empty cache.
    leave: () => publishSignedOut(serverAddress),
    offlineEngine,
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}
