import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** A card slice's row for a named entry: its `leading` picture, the name with a `tag`, the muted
 * `count`, and a lock mark (named by `lockLabel`) where it is read-only, else a chevron. */
export function CountRow({
  name,
  count,
  tag,
  leading,
  indent = 0,
  lockLabel,
  testID,
  onPress,
}: {
  name: string;
  count?: string;
  tag?: ReactNode;
  leading?: ReactNode;
  /** How far the row is set in, in points: a kind under its parent. */
  indent?: number;
  /** Set where the entry is read-only: the lock mark's accessibility label. */
  lockLabel?: string;
  testID?: string;
  onPress?: () => void;
}) {
  const muted = useTokenColor("muted");
  const content = (
    <>
      {leading}
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Text className="text-foreground shrink text-base" numberOfLines={1}>
          {name}
        </Text>
        {tag}
      </View>
      {count ? <Text className="text-muted text-base">{count}</Text> : null}
      {lockLabel ? (
        <View accessibilityLabel={lockLabel} accessibilityRole="image" accessible>
          <Ionicons color={muted} name="lock-closed-outline" size={15} />
        </View>
      ) : onPress ? (
        <Ionicons color={muted} name="chevron-forward" size={16} />
      ) : null}
    </>
  );
  const className = "min-h-[52px] flex-row items-center gap-3 px-4";

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      className={className}
      style={indent ? { paddingLeft: 16 + indent } : undefined}
      testID={testID}
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    <View
      className={className}
      style={indent ? { paddingLeft: 16 + indent } : undefined}
      testID={testID}
    >
      {content}
    </View>
  );
}
