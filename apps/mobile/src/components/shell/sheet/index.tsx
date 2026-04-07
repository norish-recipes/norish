import type { PresentationDetent } from "@expo/ui/swift-ui/modifiers";
import React from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import { presentationDetents, presentationDragIndicator } from "@expo/ui/swift-ui/modifiers";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "heroui-native";

export interface ShellSheetProps {
  /** Whether the sheet is currently presented. */
  isPresented: boolean;
  /** Called when the presented state changes (e.g. user swipes to dismiss). */
  onIsPresentedChange: (isPresented: boolean) => void;
  /** Allowed sheet heights. Defaults to medium + large. */
  detents?: PresentationDetent[];
  /** Height used whenever the sheet is newly presented. */
  initialDetent?: PresentationDetent;
  children: React.ReactNode;
}

/**
 * Base wrapper for SwiftUI BottomSheets that contain React Native content.
 *
 * Uses iOS medium + large detents instead of fit-to-contents sizing.
 * This is more stable for RN-driven content and avoids occasional near-zero
 * measured heights when Yoga and SwiftUI layout timing disagree.
 *
 * A primary close button is rendered in the top-right corner of every sheet.
 */
export function ShellSheet({
  isPresented,
  onIsPresentedChange,
  detents = ["medium", "large"],
  initialDetent = "medium",
  children,
}: ShellSheetProps) {
  const [selectedDetent, setSelectedDetent] = React.useState<PresentationDetent>(initialDetent);

  React.useEffect(() => {
    if (isPresented) {
      setSelectedDetent(initialDetent);
    }
  }, [initialDetent, isPresented]);

  return (
    <Host matchContents>
      <BottomSheet isPresented={isPresented} onIsPresentedChange={onIsPresentedChange}>
        <Group
          modifiers={[
            presentationDetents(detents, {
              selection: selectedDetent,
              onSelectionChange: setSelectedDetent,
            }),
            presentationDragIndicator("visible"),
          ]}
        >
          <RNHostView>
            <View collapsable={false} style={styles.contentRoot}>
              <View style={styles.closeRow}>
                <Button
                  isIconOnly
                  variant="primary"
                  size="md"
                  onPress={() => onIsPresentedChange(false)}
                  className="rounded-full"
                >
                  <Ionicons name="close" size={18} color="#ffffff" />
                </Button>
              </View>
              {children}
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  contentRoot: {
    flex: 1,
    alignSelf: "stretch",
  },
  closeRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: "flex-end",
  },
});
