/**
 * SwipeableRecipeRow
 *
 * Native swipeable row built on react-native-gesture-handler + react-native-reanimated.
 *
 * Left swipe  → reveals: Groceries (blue) · Calendar (yellow) · Delete (red)
 * Tap card when open → closes
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useImperativeHandle } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { createSwipeableRecipeRowStyles } from '@/features/home/components/swipeable-recipe-row.styles';

// ─── constants ────────────────────────────────────────────────────────────────

const ACTION_WIDTH = 72;
const LEFT_ACTIONS_WIDTH = ACTION_WIDTH * 3; // groceries - calendar - delete
const SPRING = { damping: 22, stiffness: 300, mass: 0.8 } as const;
const OVERSHOOT_FACTOR = 0.15;
const styles = createSwipeableRecipeRowStyles(ACTION_WIDTH, LEFT_ACTIONS_WIDTH);

// ─── types ────────────────────────────────────────────────────────────────────

export type SwipeableRecipeRowRef = {
  close: () => void;
};

type Props = {
  children: React.ReactNode;
  recipeName?: string;
  onDelete?: () => void;
  onAddToGroceries?: () => void;
  onAddToCalendar?: () => void;
};

// ─── individual action button ─────────────────────────────────────────────────

type ActionButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  progress: SharedValue<number>;
  index: number;
  total: number;
  onPress: () => void;
};

function ActionButton({ icon, color, progress, index, total, onPress }: ActionButtonProps) {
  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const delay = (index / total) * 0.35;
    const scale = interpolate(p, [delay, delay + 0.25, 1], [0.4, 0.85, 1], 'clamp');
    const opacity = interpolate(p, [delay, delay + 0.2], [0, 1], 'clamp');
    return { transform: [{ scale }], opacity };
  });

  return (
    <Animated.View style={[styles.actionOuter, animStyle]}>
      <Pressable
        onPress={onPress}
        style={[styles.actionInner, { backgroundColor: color }]}
        hitSlop={8}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

function SwipeableRecipeRowComponent(
  { children, recipeName = 'Recipe', onDelete, onAddToGroceries, onAddToCalendar }: Props,
  ref: React.ForwardedRef<SwipeableRecipeRowRef>,
) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const close = useCallback(() => {
    translateX.value = withSpring(0, SPRING);
    isOpen.value = false;
  }, [translateX, isOpen]);

  useImperativeHandle(ref, () => ({ close }), [close]);

  // ── action handlers ──────────────────────────────────────────────────────

  const handleGroceries = useCallback(() => {
    close();
    onAddToGroceries?.();
  }, [close, onAddToGroceries]);

  const handleCalendar = useCallback(() => {
    close();
    onAddToCalendar?.();
  }, [close, onAddToCalendar]);

  const handleDelete = useCallback(() => {
    close();
    Alert.alert(
      'Delete recipe',
      `Remove "${recipeName}" from your recipes?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  }, [close, recipeName, onDelete]);

  // ── gesture ──────────────────────────────────────────────────────────────

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      // Only allow left swipe (negative direction); rubber-band at the limit
      if (next > 0) {
        translateX.value = next * OVERSHOOT_FACTOR;
      } else if (next < -LEFT_ACTIONS_WIDTH) {
        translateX.value = -LEFT_ACTIONS_WIDTH + (next + LEFT_ACTIONS_WIDTH) * OVERSHOOT_FACTOR;
      } else {
        translateX.value = next;
      }
    })
    .onEnd((e) => {
      const x = translateX.value;
      const vx = e.velocityX;

      // Any rightward flick closes, regardless of position
      if (vx > 200) {
        translateX.value = withSpring(0, SPRING);
        isOpen.value = false;
        return;
      }

      // Snap open: fast leftward flick OR dragged past 40% threshold
      if (vx < -400 || x < -LEFT_ACTIONS_WIDTH * 0.4) {
        translateX.value = withSpring(-LEFT_ACTIONS_WIDTH, SPRING);
        isOpen.value = true;
        return;
      }

      // Close otherwise
      translateX.value = withSpring(0, SPRING);
      isOpen.value = false;
    });

  // Tap on the card face closes when open
  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isOpen.value) {
      translateX.value = withSpring(0, SPRING);
      isOpen.value = false;
    }
  });

  const combinedGesture = Gesture.Race(panGesture, tapGesture);

  // ── animated styles ───────────────────────────────────────────────────────

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftProgress = useSharedValue(0);

  const leftActionsStyle = useAnimatedStyle(() => {
    const p = interpolate(translateX.value, [-LEFT_ACTIONS_WIDTH, 0], [1, 0], 'clamp');
    leftProgress.value = p;
    return { opacity: p > 0 ? 1 : 0 };
  });

  return (
    <View style={styles.container}>
      {/* ── Left action strip (swipe left to reveal) ── */}
      <Animated.View style={[styles.leftActions, leftActionsStyle]}>
        <ActionButton
          icon="cart-outline"
          color="#3b82f6"
          progress={leftProgress}
          index={0}
          total={3}
          onPress={() => runOnJS(handleGroceries)()}
        />
        <ActionButton
          icon="calendar-outline"
          color="#f59e0b"
          progress={leftProgress}
          index={1}
          total={3}
          onPress={() => runOnJS(handleCalendar)()}
        />
        <ActionButton
          icon="trash-outline"
          color="#ef4444"
          progress={leftProgress}
          index={2}
          total={3}
          onPress={() => runOnJS(handleDelete)()}
        />
      </Animated.View>

      {/* ── Swipeable card row ── */}
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[styles.row, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const SwipeableRecipeRow = React.forwardRef(SwipeableRecipeRowComponent);
