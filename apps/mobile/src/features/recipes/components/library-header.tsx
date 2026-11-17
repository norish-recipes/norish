import type { HeaderItem } from "@/lib/header-item";
import type { ComponentProps } from "react";
import type { SharedValue } from "react-native-reanimated";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { GlassSurface } from "@/components/glass";
import { GlassSegmented } from "@/components/glass-segmented";
import { PressableScale } from "@/components/pressable-scale";
import { RollingText } from "@/components/rolling-text";
import { lightImpact } from "@/lib/haptics";
import { settleTo } from "@/lib/motion/settle-to";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { useDevicePreference } from "@norish/shared-react/reader";
import { useLibraryFilters } from "@norish/shared-react/recipes";
import { LIBRARY_TYPE_FILTERS } from "@norish/shared/contracts";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

const HEADING_KEYS = {
  all: "recipes.dashboard.libraryTitle",
  recipes: "recipes.dashboard.recipesTitle",
  cookbooks: "recipes.dashboard.cookbooksTitle",
} as const satisfies Record<LibraryTypeFilter, string>;

const VIEWS = [
  { mode: "grid", icon: "grid-outline", label: "recipes.dashboard.viewMode.grid" },
  { mode: "list", icon: "list-outline", label: "recipes.dashboard.viewMode.list" },
] as const satisfies readonly { mode: RecipeViewMode; icon: string; label: string }[];

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

// A segment's size and the gap to the next, in pt: the thumb is one segment and moves by one step.
const SEGMENT = { width: 38, height: 30 };
const GAP = 2;
const STEP = SEGMENT.width + GAP;

/** The grid or list toggle, the reader's own choice on this device: a thumb springs to the picked
 * segment, or fades in there under Reduce Motion. */
export function ViewToggle() {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useDevicePreference("recipeViewMode");
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const index = VIEWS.findIndex(({ mode }) => mode === view);
  const x = useSharedValue(index * STEP);
  const thumbOpacity = useSharedValue(1);
  const shownIndexRef = useRef(index);

  // The thumb leaves on the press, before the list redraws, and again for a change made elsewhere.
  const moveThumb = (to: number) => {
    if (shownIndexRef.current === to) return;

    shownIndexRef.current = to;
    if (reduceMotion) {
      x.set(to * STEP);
      thumbOpacity.set(0);
      thumbOpacity.set(settleTo(1, { reduceMotion: true }));
    } else {
      x.set(settleTo(to * STEP, { reduceMotion: false }));
    }
  };

  useEffect(() => moveThumb(index));

  const thumb = useAnimatedStyle(() => ({
    opacity: thumbOpacity.get(),
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View className="h-9 flex-row rounded-full p-[3px]" style={{ gap: GAP }}>
      <GlassSurface radius={18} />
      <Animated.View
        className="bg-thumb absolute top-[3px] left-[3px] rounded-full"
        pointerEvents="none"
        style={[SEGMENT, thumb]}
      />
      {VIEWS.map(({ mode, icon, label }, at) => (
        <PressableScale
          key={mode}
          accessibilityLabel={intl.formatMessage({ id: label })}
          accessibilityRole="button"
          accessibilityState={{ selected: view === mode }}
          testID={`library-view-${mode}`}
          onPress={() => {
            if (view !== mode) lightImpact();
            moveThumb(at);
            setView(mode);
          }}
        >
          <View className="items-center justify-center" style={SEGMENT}>
            <SegmentIcon icon={icon} picked={at} rest={muted} selectedColor={foreground} x={x} />
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

/** A segment's icon, `selectedColor` while the thumb is over segment `picked` and `rest` away from it. */
function SegmentIcon({
  icon,
  picked,
  rest,
  selectedColor,
  x,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  picked: number;
  rest: string;
  selectedColor: string;
  x: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => ({
    color: interpolateColor(
      x.get(),
      [(picked - 1) * STEP, picked * STEP, (picked + 1) * STEP],
      [rest, selectedColor, rest]
    ),
  }));

  return <AnimatedIonicons animatedProps={props} color={rest} name={icon} size={17} />;
}

/** The Filters button, marked while any filter is on. */
export function FiltersButton() {
  const intl = useIntl();
  const router = useRouter();
  const [foreground] = useThemeColor(["foreground"] as const);
  const filtersOn = hasAppliedRecipeFilters(useLibraryFilters((state) => state.filters));

  return (
    <PressableScale
      accessibilityLabel={intl.formatMessage({ id: "common.filters.title" })}
      accessibilityRole="button"
      className="bg-surface border-border size-9 items-center justify-center rounded-full border"
      testID="library-filters-button"
      onPress={() => router.push("/filters")}
    >
      <Ionicons color={foreground} name="funnel-outline" size={17} />
      {filtersOn ? (
        <View className="bg-accent border-surface absolute top-[3px] right-[3px] size-[9px] rounded-full border-2" />
      ) : null}
    </PressableScale>
  );
}

/** The Library's heading word, rolling to the lens's word the way the lens moved in LIBRARY_TYPE_FILTERS. */
function LibraryHeading({ type }: { type: LibraryTypeFilter }) {
  const intl = useIntl();
  const index = LIBRARY_TYPE_FILTERS.indexOf(type);
  const [shown, setShown] = useState({ index, rising: true });

  if (shown.index !== index) setShown({ index, rising: index > shown.index });

  return (
    <View testID="library-heading">
      <RollingText
        className="text-foreground text-2xl font-semibold"
        growth="end"
        rising={shown.rising}
        value={intl.formatMessage({ id: HEADING_KEYS[type] })}
      />
    </View>
  );
}

/**
 * The Library's heading and its grid or list toggle, the lenses and the Filters button. `scoped`,
 * for a cookbook's page, keeps only the toggle and Filters, at the page's right.
 */
export function LibraryHeader({ scoped = false }: { scoped?: boolean }) {
  const intl = useIntl();
  const filters = useLibraryFilters((state) => state.filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);

  if (scoped) {
    return (
      <View className="flex-row items-center justify-end gap-2 px-5 pt-[18px] pb-3.5">
        <ViewToggle />
        <FiltersButton />
      </View>
    );
  }

  return (
    <View className="gap-3.5 pt-7 pb-4">
      <View className="flex-row items-center justify-between px-5">
        <LibraryHeading type={filters.libraryType} />
        <ViewToggle />
      </View>
      <View className="px-5">
        <GlassSegmented
          segments={LIBRARY_TYPE_FILTERS.map((type) => ({
            value: type,
            label: intl.formatMessage({ id: `recipes.dashboard.libraryType.${type}` }),
            testID: `library-lens-${type}`,
          }))}
          testID="library-lenses"
          value={filters.libraryType}
          onChange={(type) => {
            if (type !== filters.libraryType) lightImpact();
            setFilters({ libraryType: type });
          }}
        />
      </View>
    </View>
  );
}

/** Filters as a native bar item, marked while any filter is on. */
export function useFiltersItem(): HeaderItem {
  const intl = useIntl();
  const router = useRouter();
  const filtersOn = hasAppliedRecipeFilters(useLibraryFilters((state) => state.filters));
  const label = intl.formatMessage({ id: "common.filters.title" });

  return {
    type: "button",
    label,
    accessibilityLabel: label,
    identifier: "library-filters-button",
    icon: { type: "sfSymbol", name: "line.3.horizontal.decrease" },
    selected: filtersOn,
    onPress: () => router.push("/filters"),
  };
}
