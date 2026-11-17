import React from "react";
import { Pressable, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useIntl } from "react-intl";

import type { StoreColor } from "@norish/shared/contracts";
import { STORE_COLOR_KEYS, storeHue } from "@norish/shared/lib/store-colors";

import { storeColorIn } from "../hooks/use-store-color";

/** The Store's colour: every hue in one row of 34 pt swatches, the chosen one ringed in its own. */
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
      className="flex-row justify-between px-1.5 py-0.5"
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
            className="size-[34px] rounded-full"
            style={{
              backgroundColor: storeColorIn(scheme, color),
              outlineColor: storeColorIn(scheme, color),
              outlineOffset: 2,
              outlineWidth: selected ? 2 : 0,
            }}
            testID={`store-color-${color}`}
            onPress={() => onChange(color)}
          />
        );
      })}
    </View>
  );
}
