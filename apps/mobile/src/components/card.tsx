import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SliceHairline } from "@/components/slice-row";
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
 * choice, or `children` as the end. An `icon` or a 40 pt `media` picture goes before the label (and
 * a `hint` under it), a `leading` node (a choice's dot) before it at the row's own height; the
 * hairline above all but the `first` starts at the label. */
export function CardRow({
  label,
  hint,
  icon,
  media,
  leading,
  value,
  detail,
  valueLines = 1,
  dotColor,
  first = false,
  disabled = false,
  selected,
  chevron = true,
  testID,
  onPress,
  children,
}: {
  label: string;
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  media?: ReactNode;
  leading?: ReactNode;
  value?: string;
  /** A muted second line under the value, which may run to `valueLines` lines. */
  detail?: ReactNode;
  valueLines?: number;
  dotColor?: string;
  first?: boolean;
  /** Dimmed to 40% and gives no press. */
  disabled?: boolean;
  /** The row's selected state for a choice list. */
  selected?: boolean;
  /** The chevron a pressable row ends with; false where its `children` end it, as a choice's check. */
  chevron?: boolean;
  testID?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const muted = useTokenColor("muted");
  const accentText = useTokenColor("accent-text");
  const tall = icon || media;
  const className = `${tall ? "min-h-[60px]" : "min-h-[52px]"} flex-row items-center gap-3 px-4 ${disabled ? "opacity-40" : ""}`;
  const content = (
    <>
      <SliceHairline first={first} tall={Boolean(tall)} />
      {icon ? (
        <View className="size-10 items-center justify-center">
          <Ionicons color={accentText} name={icon} size={23} />
        </View>
      ) : null}
      {media}
      {leading}
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
        <View className="max-w-[62%] items-end gap-px">
          <Text className="text-muted text-base" numberOfLines={valueLines}>
            {value}
          </Text>
          {detail ? (
            <Text className="text-muted text-[13px]" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      )}
      {children}
      {onPress && chevron ? <Ionicons color={muted} name="chevron-forward" size={16} /> : null}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
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
