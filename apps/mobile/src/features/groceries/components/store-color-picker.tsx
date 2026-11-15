import React from "react";
import { Pressable, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useIntl } from "react-intl";

import type { StoreColor } from "@norish/shared/contracts";
import { STORE_COLOR_KEYS, storeHue } from "@norish/shared/lib/store-colors";

import { storeColorIn } from "../hooks/use-store-color";

/** The Store's colour, one swatch per hue, the chosen one ringed in its own colour. */
export function StoreColorPicker({
  value,
  onChange,
}: {
  value: StoreColor;
  onChange: (color: StoreColor) => void;
}) {
  const intl = useIntl();
  const scheme = useResolvedColorScheme();

  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row flex-wrap gap-3 px-2"
      testID="store-colors"
    >
      {STORE_COLOR_KEYS.map((color) => {
        const selected = value === color;

        return (
          <Pressable
            key={color}
            accessibilityLabel={intl.formatMessage({
              id: `groceries.storeManager.colorNames.${storeHue(color).name}`,
            })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className="size-10 items-center justify-center rounded-full border-2"
            style={{ borderColor: selected ? storeColorIn(scheme, color) : "transparent" }}
            testID={`store-color-${color}`}
            onPress={() => onChange(color)}
          >
            <View
              className="size-7 rounded-full"
              style={{ backgroundColor: storeColorIn(scheme, color) }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
