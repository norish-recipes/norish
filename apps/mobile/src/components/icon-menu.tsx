import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import { Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityIdentifier, accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The kit's `IconButton` look (a solid 40 pt circle, never glass) opening a native menu of `children`. */
export function IconMenu({
  icon,
  label,
  testID,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  testID: string;
  children: ReactNode;
}) {
  const color = useTokenColor("foreground");

  return (
    <Host matchContents>
      <Menu
        label={
          <RNHostView matchContents>
            <View className="bg-thumb size-10 items-center justify-center rounded-full shadow-sm">
              <Ionicons color={color} name={icon} size={20} />
            </View>
          </RNHostView>
        }
        modifiers={[accessibilityLabel(label), accessibilityIdentifier(testID)]}
      >
        {children}
      </Menu>
    </Host>
  );
}
