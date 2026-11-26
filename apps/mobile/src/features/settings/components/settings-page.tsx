import type { ReactNode } from "react";
import React from "react";
import { ScrollView } from "react-native";
import { ModalHeader } from "@/components/modal-header";

import { OfflineCapsule } from "@/components/offline-capsule";

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
  return (
    <>
      <ModalHeader back title={title} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="px-5 pb-16"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID={testID}
      >
        <OfflineCapsule />
        {children}
      </ScrollView>
    </>
  );
}
