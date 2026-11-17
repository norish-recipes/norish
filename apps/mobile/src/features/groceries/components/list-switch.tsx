import React from "react";
import { Pressable, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { useTokenColor } from "@/hooks/use-token-color";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useIntl } from "react-intl";

export type ListSection = "list" | "pantry";

const SEGMENTS = [
  { value: "list", icon: "clipboard-check-outline", labelId: "groceries.page.title" },
  { value: "pantry", icon: "archive-outline", labelId: "groceries.page.pantry" },
] as const;

/** The title row's glass switch between the list and the Pantry. */
export function ListSwitch({
  value,
  onChange,
}: {
  value: ListSection;
  onChange: (value: ListSection) => void;
}) {
  const intl = useIntl();
  const foreground = useTokenColor("foreground");
  const muted = useTokenColor("muted");

  return (
    <View className="h-11 w-[100px] flex-row items-center gap-0.5 p-1" testID="groceries-switch">
      <GlassSurface radius={22} />
      {SEGMENTS.map((segment) => {
        const selected = segment.value === value;

        return (
          <Pressable
            key={segment.value}
            accessibilityLabel={intl.formatMessage({ id: segment.labelId })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`h-9 flex-1 items-center justify-center rounded-full ${selected ? "bg-surface" : ""}`}
            testID={`groceries-switch-${segment.value}`}
            onPress={() => onChange(segment.value)}
          >
            <MaterialCommunityIcons
              color={selected ? foreground : muted}
              name={segment.icon}
              size={20}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
