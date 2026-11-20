import type { ComponentProps } from "react";
import React from "react";
import { Text } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The kit's chip, such as a filter or a Category: sand, accent while it applies. */
export function ToggleChip({
  label,
  icon,
  active,
  even = false,
  mutedIcon = false,
  onPress,
  testID,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  /** Share the row evenly with its siblings, the label centred. */
  even?: boolean;
  /** Draw the icon muted rather than in the warning colour. */
  mutedIcon?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const warning = useTokenColor("warning");
  const muted = useTokenColor("muted");
  const accentForeground = useTokenColor("accent-foreground");

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-9 flex-row items-center gap-1.5 rounded-full ${even ? "flex-1 justify-center" : "flex-none px-3.5"} ${active ? "bg-accent" : "bg-sand border-stroke border-[0.5px]"}`}
      testID={testID}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons
          color={active ? accentForeground : mutedIcon ? muted : warning}
          name={icon}
          size={15}
        />
      ) : null}
      <Text
        className={`text-[15px] ${active ? "text-accent-foreground font-semibold" : "text-foreground font-medium"}`}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
