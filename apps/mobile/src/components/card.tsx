import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The kit's one card: rows on a solid sand card with a hairline edge. */
export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      className="bg-sand border-stroke overflow-hidden rounded-[22px] border-[0.5px]"
      testID={testID}
    >
      {children}
    </View>
  );
}

/** A card row: its label, a `value` (with a Store's dot), then a chevron where `onPress` opens a
 * choice, or `children` as the end. A hairline sits above all but the `first`. */
export function CardRow({
  label,
  value,
  dotColor,
  first = false,
  testID,
  onPress,
  children,
}: {
  label: string;
  value?: string;
  dotColor?: string;
  first?: boolean;
  testID?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const muted = useTokenColor("muted");
  const className = `min-h-[52px] flex-row items-center gap-2 px-4 ${first ? "" : "border-line border-t"}`;
  const content = (
    <>
      <Text className="text-foreground flex-1 text-base">{label}</Text>
      {dotColor ? (
        <View className="size-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
      ) : null}
      {value === undefined ? null : (
        <Text className="text-muted max-w-[62%] text-base" numberOfLines={1}>
          {value}
        </Text>
      )}
      {children}
      {onPress ? <Ionicons color={muted} name="chevron-forward" size={16} /> : null}
    </>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" className={className} testID={testID} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    <View className={className} testID={testID}>
      {content}
    </View>
  );
}
