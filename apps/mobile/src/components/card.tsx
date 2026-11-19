import type { ComponentProps, ReactNode } from "react";
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
 * choice, or `children` as the end. An `icon` adds a glyph before the label (and a `hint` under
 * it); the hairline above all but the `first` starts at the label. */
export function CardRow({
  label,
  hint,
  icon,
  value,
  dotColor,
  first = false,
  disabled = false,
  testID,
  onPress,
  children,
}: {
  label: string;
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  value?: string;
  dotColor?: string;
  first?: boolean;
  /** Dimmed to 40% and gives no press. */
  disabled?: boolean;
  testID?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const muted = useTokenColor("muted");
  const accentText = useTokenColor("accent-text");
  const className = `${icon ? "min-h-[60px]" : "min-h-[52px]"} flex-row items-center gap-3 px-4 ${disabled ? "opacity-40" : ""}`;
  const content = (
    <>
      {first ? null : (
        <View
          className={`bg-line absolute top-0 right-0 h-px ${icon ? "left-[68px]" : "left-4"}`}
        />
      )}
      {icon ? (
        <View className="size-10 items-center justify-center">
          <Ionicons color={accentText} name={icon} size={23} />
        </View>
      ) : null}
      {hint ? (
        <View className="min-w-0 flex-1 gap-px">
          <Text className="text-foreground text-base">{label}</Text>
          <Text className="text-muted text-sm">{hint}</Text>
        </View>
      ) : (
        <Text className="text-foreground flex-1 text-base">{label}</Text>
      )}
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={className}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    <View className={className} testID={testID}>
      {content}
    </View>
  );
}
