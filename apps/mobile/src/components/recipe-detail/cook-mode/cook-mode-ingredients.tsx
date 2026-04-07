import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Separator, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";
import { withUniwind } from "uniwind";

import type { RecipeIngredientsDto } from "@norish/shared/contracts";
import { formatAmount } from "@norish/shared/lib/format-amount";

const StyledEntypo = withUniwind(Entypo);

const SWIPE_THRESHOLD = 60;
const SPRING = { damping: 20, stiffness: 200, mass: 0.8 } as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function calcDecServings(servings: number): number {
  if (servings <= 1) return Math.max(0.125, servings / 2);
  if (servings <= 2) return 1;
  return servings - 1;
}

function calcIncServings(servings: number): number {
  return servings < 1 ? Math.min(1, servings * 2) : servings + 1;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type CookModeIngredientsProps = {
  ingredients: RecipeIngredientsDto[];
  baseServings: number;
  servings: number;
  onServingsChange: (s: number) => void;
  onSwipeRight?: () => void;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CookModeIngredients({
  ingredients,
  baseServings,
  servings,
  onServingsChange,
  onSwipeRight,
}: CookModeIngredientsProps) {
  const intl = useIntl();
  const [foregroundColor, mutedColor, accentColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
  ] as const);

  const { mode: amountMode, toggleMode: toggleAmountMode } = useAmountDisplayPreference();
  const scale = servings / baseServings;

  // ── Gesture: swipe right → back to steps with rubber-banding ──────────────
  const translateX = useSharedValue(0);

  const triggerSwipeRight = useCallback(() => {
    onSwipeRight?.();
  }, [onSwipeRight]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      // Only rubber-band rightward
      if (e.translationX > 0) {
        translateX.value = e.translationX * 0.35;
      }
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        scheduleOnRN(triggerSwipeRight);
      }
      // Spring back smoothly
      translateX.value = withSpring(0, SPRING);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const dec = useCallback(() => {
    onServingsChange(calcDecServings(servings));
  }, [servings, onServingsChange]);

  const inc = useCallback(() => {
    onServingsChange(calcIncServings(servings));
  }, [servings, onServingsChange]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={animatedStyle}
      >
        {/* Servings control */}
        <View className="mb-5 flex-row items-center justify-between py-2">
          <Text className="text-[15px] font-medium" style={{ color: mutedColor }}>
            {intl.formatMessage({ id: "recipes.cookMode.servings" })}
          </Text>
          <View className="flex-row items-center gap-3">
            {/* Fraction / decimal toggle */}
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              className="bg-surface-tertiary size-8 rounded-lg"
              onPress={toggleAmountMode}
            >
              <Text className="text-foreground text-xs font-semibold">
                {amountMode === "fraction" ? "½" : "0.5"}
              </Text>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              className="bg-surface-tertiary size-8 rounded-lg"
              onPress={dec}
            >
              <StyledEntypo name="minus" size={14} className="text-foreground" />
            </Button>
            <Text
              className="min-w-[28px] text-center text-lg font-bold"
              style={{ color: foregroundColor }}
            >
              {formatServings(servings)}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              className="bg-surface-tertiary size-8 rounded-lg"
              onPress={inc}
            >
              <StyledEntypo name="plus" size={14} className="text-foreground" />
            </Button>
          </View>
        </View>

        {/* Ingredient list */}
        {ingredients.map((item, index) => {
          const displayName = item.ingredientName ?? "";
          const isHeading = displayName.trim().startsWith("#");

          if (isHeading) {
            const headingText = displayName.trim().replace(/^#+\s*/, "");
            return (
              <React.Fragment key={`heading-${index}`}>
                {index > 0 && <View className="h-3" />}
                <View
                  className="mb-1 pb-2"
                  style={{
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: `${mutedColor}15`,
                  }}
                >
                  <Text
                    className="text-[15px] font-bold uppercase"
                    style={{ color: accentColor, letterSpacing: 0.3 }}
                  >
                    {headingText}
                  </Text>
                </View>
              </React.Fragment>
            );
          }

          // Scale numeric amounts
          const scaledAmount =
            item.amount != null && !isNaN(Number(item.amount))
              ? formatAmount(Number(item.amount) * scale, amountMode)
              : null;

          // Strip markdown
          const cleanName = displayName
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/\[(.+?)\]\(.+?\)/g, "$1");

          return (
            <React.Fragment key={`${item.id ?? displayName}-${index}`}>
              <View className="flex-row items-center gap-3 py-3.5">
                <View
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <Text
                  className="flex-1 text-[17px]"
                  style={{ color: foregroundColor }}
                  numberOfLines={2}
                >
                  {cleanName}
                </Text>
                <Text className="shrink-0 text-[15px] font-medium" style={{ color: mutedColor }}>
                  {[scaledAmount, item.unit].filter(Boolean).join(" ")}
                </Text>
              </View>
              {index < ingredients.length - 1 &&
                !(ingredients[index + 1]?.ingredientName ?? "").trim().startsWith("#") && (
                  <Separator className="opacity-20" />
                )}
            </React.Fragment>
          );
        })}

        {/* Swipe hint */}
        <View className="mt-6 flex-row items-center justify-center gap-1.5">
          <Ionicons name="arrow-forward" size={14} color={`${mutedColor}80`} />
          <Text className="text-xs" style={{ color: `${mutedColor}80` }}>
            {intl.formatMessage({ id: "recipes.cookMode.swipeBackToSteps" })}
          </Text>
        </View>
      </Animated.ScrollView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
});
