import Entypo from '@expo/vector-icons/Entypo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Separator, useThemeColor } from 'heroui-native';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useIntl } from 'react-intl';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { withUniwind } from 'uniwind';

import type { DummyIngredient } from '../dummy-data';

const StyledEntypo = withUniwind(Entypo);

const SWIPE_THRESHOLD = 60;
const SPRING = { damping: 20, stiffness: 200, mass: 0.8 } as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
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
  ingredients: DummyIngredient[];
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
    'foreground',
    'muted',
    'accent',
  ] as const);

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
        <View className="flex-row items-center justify-between mb-5 py-2">
          <Text
            className="text-[15px] font-medium"
            style={{ color: mutedColor }}
          >
            {intl.formatMessage({ id: 'recipes.cookMode.servings' })}
          </Text>
          <View className="flex-row items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              className="size-8 rounded-lg bg-surface-tertiary"
              onPress={dec}
            >
              <StyledEntypo
                name="minus"
                size={14}
                className="text-foreground"
              />
            </Button>
            <Text
              className="text-lg font-bold min-w-[28px] text-center"
              style={{ color: foregroundColor }}
            >
              {formatServings(servings)}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              isIconOnly
              className="size-8 rounded-lg bg-surface-tertiary"
              onPress={inc}
            >
              <StyledEntypo
                name="plus"
                size={14}
                className="text-foreground"
              />
            </Button>
          </View>
        </View>

        {/* Ingredient list */}
        {ingredients.map((item, index) => {
          const isHeading = item.name.trim().startsWith('#');

          if (isHeading) {
            const headingText = item.name.trim().replace(/^#+\s*/, '');
            return (
              <React.Fragment key={`heading-${index}`}>
                {index > 0 && <View className="h-3" />}
                <View
                  className="pb-2 mb-1"
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
            item.amount && !isNaN(Number(item.amount))
              ? formatServings(Number(item.amount) * scale)
              : item.amount;

          // Strip markdown
          const cleanName = item.name
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1');

          return (
            <React.Fragment key={`${item.name}-${index}`}>
              <View className="flex-row items-center py-3.5 gap-3">
                <View
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
                <Text
                  className="text-[17px] flex-1"
                  style={{ color: foregroundColor }}
                  numberOfLines={2}
                >
                  {cleanName}
                </Text>
                <Text
                  className="text-[15px] font-medium shrink-0"
                  style={{ color: mutedColor }}
                >
                  {[scaledAmount, item.unit].filter(Boolean).join(' ')}
                </Text>
              </View>
              {index < ingredients.length - 1 &&
                !ingredients[index + 1]?.name.trim().startsWith('#') && (
                  <Separator className="opacity-20" />
                )}
            </React.Fragment>
          );
        })}

        {/* Swipe hint */}
        <View className="flex-row items-center gap-1.5 mt-6 justify-center">
          <Ionicons
            name="arrow-forward"
            size={14}
            color={`${mutedColor}80`}
          />
          <Text className="text-xs" style={{ color: `${mutedColor}80` }}>
            {intl.formatMessage({ id: 'recipes.cookMode.swipeBackToSteps' })}
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
