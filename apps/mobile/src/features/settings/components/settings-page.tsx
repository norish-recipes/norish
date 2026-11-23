import type { ReactNode } from "react";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { ModalHeader } from "@/components/modal-header";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";

/** A settings page: the native back header with its small centred title, and the scrolling groups.
 * Offline, a glass capsule says why the page's changes are off. */
export function SettingsPage({
  title,
  testID,
  children,
}: {
  title: string;
  testID: string;
  children?: ReactNode;
}) {
  const intl = useIntl();
  const { isOffline } = useConnectivity();

  return (
    <>
      <ModalHeader back title={title} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="px-5 pb-16"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        testID={testID}
      >
        {isOffline ? (
          <View
            className="mt-2 h-[30px] items-center justify-center self-center px-3.5"
            testID="settings-offline"
          >
            <GlassSurface radius={15} />
            <Text className="text-foreground text-[13px] font-medium">
              {intl.formatMessage({ id: "settings.mobile.offlineReason" })}
            </Text>
          </View>
        ) : null}
        {children}
      </ScrollView>
    </>
  );
}
