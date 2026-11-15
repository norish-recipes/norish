import React from "react";
import { Pressable, Text } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { TAB_ROUTES } from "@/lib/tab-routes";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

/** The tab bar's bottom accessory on Calendar: Plan recipe opens the plan sheet with its day picker. */
export function PlanRecipeAccessory() {
  const intl = useIntl();
  const router = useRouter();
  const accent = useAccentTextColor();
  const label = intl.formatMessage({ id: "calendar.mobile.planRecipe" });

  return (
    <Pressable
      // Named outright: VoiceOver would read the icon font's glyph too.
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-full flex-row items-center justify-center gap-2"
      testID="plan-recipe-accessory"
      onPress={() => router.push(TAB_ROUTES.calendar.planRecipe)}
    >
      <Ionicons color={accent} name="calendar-outline" size={22} />
      <Text className="text-foreground text-base font-semibold">{label}</Text>
    </Pressable>
  );
}
