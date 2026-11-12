import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { reloadAuthTransport } from "@/lib/auth/auth-session-sync";
import { offlineEngine } from "@/lib/offline/engine";
import { storage } from "@/lib/storage/mmkv";
import { useRouter } from "expo-router";
import { Toast, useThemeColor, useToast } from "heroui-native";
import { useIntl } from "react-intl";

import type {
  PlatformAdapter,
  PlatformSession,
  PlatformStorage,
} from "@norish/shared-react/platform";
import { createIntlMessageTranslator } from "@norish/i18n";
import { PlatformProvider } from "@norish/shared-react/platform";
import { createClientLogger } from "@norish/shared/lib/logger";

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
  const [dangerColor] = useThemeColor(["danger"] as const);

  const adapter: PlatformAdapter = {
    toast: {
      show: ({ severity, title, description, actionLabel, onActionPress }) =>
        toast.show({
          variant: severity,
          label: title,
          description,
          actionLabel,
          onActionPress: ({ hide }) => {
            hide();
            onActionPress?.();
          },
        }),
      translate: createIntlMessageTranslator(intl.formatMessage),
    },
    navigation: {
      toHome: () => router.replace("/"),
      // No recipe screen yet; the library's migration adds one.
      toRecipe: (id) => log.warn({ id }, "No recipe screen to open"),
    },
    showError: (error, context, title) => {
      log.error({ error }, context);
      toast.show({
        component: (props) => (
          <Toast variant="danger" {...props} className="gap-1">
            <View>
              <Toast.Title className="text-foreground">
                {title ?? intl.formatMessage({ id: "common.errors.operationFailed" })}
              </Toast.Title>
              <Toast.Description className="text-muted">
                {intl.formatMessage({ id: "common.errors.technicalDetails" })}
              </Toast.Description>
              <Toast.Description style={{ color: dangerColor }}>
                {error instanceof Error ? error.message : String(error)}
              </Toast.Description>
            </View>
          </Toast>
        ),
      });
    },
    storage: mmkvStorage,
    deviceKind,
    session,
    endSession,
    // After the clear, so screens the signed-out route guard mounted earlier rebuild on the empty cache.
    leave: reloadAuthTransport,
    offlineEngine,
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}
