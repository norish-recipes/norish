import React from "react";
import { ScrollView, Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { PressableScale } from "@/components/pressable-scale";
import { homeIndicator } from "@/lib/home-indicator";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { SearchField } from "@norish/shared/contracts";
import { useLibraryFilters } from "@norish/shared-react/recipes";

import { useKeyboardHeight } from "../hooks/use-keyboard-height";
import { SCOPE_FIELDS, toggleScope } from "../utils/search-scope";

// Clear of the field: the keyboard's top, or the tab bar's search pill at rest.
const ABOVE_KEYBOARD = 62;
const ABOVE_TAB_BAR = homeIndicator + 48;

/** The Search Scope: glass chips floating above the field, one per field the search looks in. */
export function ScopeRow() {
  const intl = useIntl();
  const keyboard = useKeyboardHeight();
  const scope = useLibraryFilters((state) => state.filters.searchFields);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);

  return (
    <View
      className="absolute inset-x-0"
      pointerEvents="box-none"
      style={{ bottom: keyboard > 0 ? keyboard + ABOVE_KEYBOARD : ABOVE_TAB_BAR }}
      testID="search-scope"
    >
      <ScrollView
        horizontal
        accessibilityLabel={intl.formatMessage({ id: "common.filters.searchIn" })}
        contentContainerClassName="gap-2 px-4 py-1.5"
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
      >
        {SCOPE_FIELDS.map((field: SearchField) => {
          const on = scope.includes(field);

          return (
            <PressableScale
              key={field}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className="h-9 flex-none flex-row items-center gap-[5px] rounded-full px-3.5"
              testID={`search-scope-${field}`}
              onPress={() => setFilters({ searchFields: toggleScope(scope, field) })}
            >
              <GlassSurface radius={18} />
              {on ? <Ionicons color={foreground} name="checkmark" size={14} /> : null}
              <Text className="text-[15px] font-medium" style={{ color: on ? foreground : muted }}>
                {intl.formatMessage({ id: `recipes.dashboard.searchFields.${field}` })}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}
