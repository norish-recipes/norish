import React from "react";
import { Pressable, Text, View } from "react-native";
import { IngredientIcon } from "@/components/ingredient-icon";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** A kept food that still has a grocery to buy: handled, so nobody adds it twice. */
export function OnTheListChip() {
  const intl = useIntl();
  const accentText = useAccentTextColor();

  return (
    <View
      className="bg-accent/10 h-[30px] flex-row items-center gap-1 rounded-full pr-2.5 pl-2"
      testID="on-the-list"
    >
      <Ionicons color={accentText} name="checkmark" size={13} />
      <Text className="text-accent-text text-[13px] font-semibold">
        {intl.formatMessage({ id: "groceries.pantry.onTheList" })}
      </Text>
    </View>
  );
}

/** The round 36 pt button at the end of a row. */
export function RowButton({
  icon,
  label,
  testID,
  accent = false,
  onPress,
}: {
  icon: "cart-outline" | "add";
  label: string;
  testID: string;
  accent?: boolean;
  onPress: () => void;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);
  const accentText = useAccentTextColor();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-default size-9 items-center justify-center rounded-full"
      hitSlop={4}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons
        color={accent ? accentText : foreground}
        name={icon}
        size={icon === "add" ? 20 : 17}
      />
    </Pressable>
  );
}

/** One food of the Pantry's lists: its icon, its name, what it says under the name, and an end. */
export function FoodRow({
  ingredientId,
  name,
  subline,
  testID,
  onPress,
  end,
}: {
  ingredientId: string | null;
  name: string;
  subline?: string;
  testID: string;
  /** A tap on the row; none where the row only holds its end. */
  onPress?: () => void;
  end: React.ReactNode;
}) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-3 pr-2.5 pl-3.5" testID={testID}>
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        className="min-h-[52px] min-w-0 flex-1 flex-row items-center gap-3"
        disabled={!onPress}
        onPress={onPress}
      >
        <IngredientIcon ingredientId={ingredientId} />
        <View className="min-w-0 flex-1">
          <Text className="text-foreground text-base" numberOfLines={1}>
            {name}
          </Text>
          {subline ? (
            <Text className="text-muted text-[13px]" numberOfLines={1}>
              {subline}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {end}
    </View>
  );
}
