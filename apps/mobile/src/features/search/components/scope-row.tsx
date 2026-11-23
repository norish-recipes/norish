import React from "react";
import { ScrollView, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { GlassSurface } from "@/components/glass";
import { PressableScale } from "@/components/pressable-scale";
import { homeIndicator } from "@/lib/home-indicator";
import { useFadeProgress } from "@/lib/motion/fade-to";
import { springTo } from "@/lib/motion/spring";
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
// The check: its path in an 18-point box, drawn at 14 points with the label 5 points after it.
const CHECK_PATH = "M4 9.5L8 13L14 6";
const CHECK_LENGTH = 15;
const CHECK_SIZE = 14;
const CHECK_GAP = 5;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The stroke's timing; unticking closes the slot on it too, so erasing and closing are one motion.
const CHECK_TIMING = { duration: 150, easing: Easing.out(Easing.ease) };

/** The chip's check, drawn in and out as the web checkbox draws its own; its slot opens and closes with it. */
function DrawnCheck({ shown, color }: { shown: boolean; color: string }) {
  const reduceMotion = useReducedMotion();
  const to = shown ? 1 : 0;
  const drawn = useDerivedValue(() => {
    if (reduceMotion) return to;

    return shown ? withDelay(100, withTiming(1, CHECK_TIMING)) : withTiming(0, CHECK_TIMING);
  });
  // Opening springs, clamped: its slight overshoot would widen the chip past its end and back.
  const open = useDerivedValue(() => {
    if (reduceMotion) return to;

    return shown ? springTo(1, { overshootClamping: true }) : withTiming(0, CHECK_TIMING);
  });
  const slot = useAnimatedStyle(() => ({ width: (CHECK_SIZE + CHECK_GAP) * open.get() }));
  const stroke = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - drawn.get()) }));

  return (
    <Animated.View className="overflow-hidden" style={slot}>
      <Svg fill="none" height={CHECK_SIZE} viewBox="0 0 18 18" width={CHECK_SIZE}>
        <AnimatedPath
          animatedProps={stroke}
          d={CHECK_PATH}
          stroke={color}
          strokeDasharray={CHECK_LENGTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
        />
      </Svg>
    </Animated.View>
  );
}

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
      className="h-9 flex-none flex-row items-center rounded-full px-3.5"
      testID={`search-scope-${field}`}
      onPress={() => setFilters({ searchFields: toggleScope(scope, field) })}
    >
      <GlassSurface radius={18} />
      <DrawnCheck color={foreground} shown={on} />
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
