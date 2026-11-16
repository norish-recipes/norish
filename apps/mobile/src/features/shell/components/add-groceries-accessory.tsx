import React from "react";
import { Pressable, Text } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { TAB_ROUTES } from "@/lib/tab-routes";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { AccessoryProps } from "../utils/accessory-plan";

/** The tab bar's bottom accessory on Groceries: Add items opens the add sheet. */
export function AddGroceriesAccessory({ compact }: AccessoryProps) {
  const intl = useIntl();
  const router = useRouter();
  const accent = useAccentTextColor();
  const label = intl.formatMessage({ id: "groceries.page.addItems" });

  return (
    <Pressable
      // Named outright: VoiceOver would read the icon font's glyph too.
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-full flex-row items-center justify-center gap-2"
      testID="add-grocery"
      onPress={() => router.push(TAB_ROUTES.groceries.add)}
    >
      <Ionicons color={accent} name="add-circle-outline" size={22} />
      {compact ? null : <Text className="text-foreground text-base font-semibold">{label}</Text>}
    </Pressable>
  );
}
