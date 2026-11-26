import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** A list with nothing in it: the area's icon in muted ink on the left, the title on the right and
 * at most one action under them. A sheet passes its own `className`. */
export function EmptyCard({
  icon,
  title,
  className = "bg-surface mx-5",
  testID,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  className?: string;
  testID: string;
  children?: ReactNode;
}) {
  const iconColor = useTokenColor("muted");

  return (
    <View className={`${className} gap-3.5 rounded-3xl p-[18px]`} testID={testID}>
      <View className="flex-row items-center gap-2.5">
        <View className="size-6 items-center justify-center">
          <Ionicons color={iconColor} name={icon} size={22} />
        </View>
        <Text className="text-foreground min-w-0 flex-1 text-lg font-semibold">{title}</Text>
      </View>
      {children}
    </View>
  );
}
