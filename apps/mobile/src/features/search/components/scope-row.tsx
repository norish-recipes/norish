import React from "react";
import { ScrollView, Text } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { GlassSurface } from "@/components/glass";
import { PressableScale } from "@/components/pressable-scale";
import { homeIndicator } from "@/lib/home-indicator";
import { useFadeProgress } from "@/lib/motion/fade-to";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { SearchField } from "@norish/shared/contracts";
import { useLibraryFilters } from "@norish/shared-react/recipes";
import { useTimerStore } from "@norish/shared-react/recipes/timers";

import { useKeyboardHeight } from "../hooks/use-keyboard-height";
import { SCOPE_FIELDS, toggleScope } from "../utils/search-scope";

// Clear of the field: the keyboard's top, or the tab bar's search pill at rest.
const ABOVE_KEYBOARD = 62;
const ABOVE_TAB_BAR = homeIndicator + 48;
// The timer accessory sits between the row and the tab bar's field while a timer runs; the keyboard hides it.
const ACCESSORY = 54;
// The row waits for the field to finish extending, then settles in as one: a fade from a slightly smaller size.
const FIELD_EXTENDS_MS = 400;
const FADE_OUT_MS = 120;
const SETTLE_FROM = 0.92;

/** One chip of the Search Scope. */
function ScopeChip({ field }: { field: SearchField }) {
  const intl = useIntl();
  const scope = useLibraryFilters((state) => state.filters.searchFields);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const on = scope.includes(field);

  return (
    <PressableScale
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
}

/** The Search Scope: glass chips floating above the field, one per field the search looks in. It stays
 * mounted so it always knows where the keyboard is; `visible` settles it in once the field has extended. */
export function ScopeRow({ visible }: { visible: boolean }) {
  const intl = useIntl();
  const keyboard = useKeyboardHeight();
  const hasTimers = useTimerStore((state) => state.timers.length > 0);
  const reduceMotion = useReducedMotion();
  const shown = useFadeProgress(visible ? 1 : 0, FIELD_EXTENDS_MS, FADE_OUT_MS);
  const settle = reduceMotion ? 1 : SETTLE_FROM;
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: settle + (1 - settle) * shown.get() }],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      className="absolute inset-x-0"
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        {
          bottom:
            keyboard > 0 ? keyboard + ABOVE_KEYBOARD : ABOVE_TAB_BAR + (hasTimers ? ACCESSORY : 0),
        },
        style,
      ]}
      testID="search-scope"
    >
      <ScrollView
        horizontal
        accessibilityLabel={intl.formatMessage({ id: "common.filters.searchIn" })}
        contentContainerClassName="gap-2 px-4 py-1.5"
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
      >
        {SCOPE_FIELDS.map((field) => (
          <ScopeChip key={field} field={field} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}
