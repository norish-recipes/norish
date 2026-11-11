import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { useAuth } from "@/lib/auth/auth-context";
import { storage } from "@/lib/storage/mmkv";
import { useRouter } from "expo-router";
import { Toast, useThemeColor, useToast } from "heroui-native";
import { useIntl } from "react-intl";

import type { PlatformAdapter, PlatformStorage } from "@norish/shared-react/platform";
import { createIntlMessageTranslator } from "@norish/i18n";
import { PlatformProvider } from "@norish/shared-react/platform";
import { sessionReader } from "@norish/shared-react/reader";
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

/** The mobile app's platform adapter: heroui-native toasts, Expo Router, MMKV, the auth context. */
export function MobilePlatformProvider({ children }: { children: ReactNode }) {
  const intl = useIntl();
  const { user, isLoading, signOut } = useAuth();
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
      toSignIn: () => router.replace("/login"),
    },
    showError: (error, context) => {
      log.error({ error }, context);
      toast.show({
        component: (props) => (
          <Toast variant="danger" {...props} className="gap-1">
            <View>
              <Toast.Title className="text-foreground">
                {intl.formatMessage({ id: "common.errors.operationFailed" })}
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
    session: { user: user ? sessionReader(user) : null, isPending: isLoading },
    signOut,
  };

  return <PlatformProvider adapter={adapter}>{children}</PlatformProvider>;
}
