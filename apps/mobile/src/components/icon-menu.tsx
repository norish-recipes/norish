import type { MenuItem } from "@/components/native-menu";
import type { ComponentProps } from "react";
import React from "react";
import { View } from "react-native";
import { NativeMenu } from "@/components/native-menu";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The kit's `IconButton` look (a solid 40 pt circle, never glass) opening iOS's menu of `items`. */
export function IconMenu({
  icon,
  label,
  testID,
  items,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  testID: string;
  items: MenuItem[];
}) {
  const color = useTokenColor("foreground");

  return (
    <NativeMenu items={items} label={label} testID={testID}>
      <View className="bg-thumb size-10 items-center justify-center rounded-full shadow-sm">
        <Ionicons color={color} name={icon} size={20} />
      </View>
    </NativeMenu>
  );
}
