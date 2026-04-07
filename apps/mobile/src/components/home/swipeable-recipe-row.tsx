import type { SharedValue } from "react-native-reanimated";
import React, { useCallback, useImperativeHandle } from "react";
import { Alert, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { createSwipeableRecipeRowStyles } from "@/styles/swipeable-recipe-row.styles";
import { Ionicons } from "@expo/vector-icons";
import { useIntl } from "react-intl";

const ACTION_WIDTH = 72;
const SPRING = { damping: 22, stiffness: 300, mass: 0.8 } as const;
const OVERSHOOT_FACTOR = 0.15;
const styles = createSwipeableRecipeRowStyles(ACTION_WIDTH, ACTION_WIDTH * 3);

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

type ActionButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
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
    const scale = interpolate(p, [delay, delay + 0.25, 1], [0.4, 0.85, 1], "clamp");
    const opacity = interpolate(p, [delay, delay + 0.2], [0, 1], "clamp");
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

function SwipeableRecipeRowComponent(
  { children, recipeName = "Recipe", onDelete, onAddToGroceries, onAddToCalendar }: Props,
  ref: React.ForwardedRef<SwipeableRecipeRowRef>
) {
  const intl = useIntl();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const actionCount = onDelete ? 3 : 2;
  const leftActionsWidth = ACTION_WIDTH * actionCount;

  const close = useCallback(() => {
    translateX.value = withSpring(0, SPRING);
    isOpen.value = false;
  }, [translateX, isOpen]);

  useImperativeHandle(ref, () => ({ close }), [close]);

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
      intl.formatMessage({ id: "recipes.card.deleteRecipe" }),
      intl.formatMessage({ id: "recipes.deleteModal.confirmMessage" }, { recipeName }),
      [
        { text: intl.formatMessage({ id: "common.actions.cancel" }), style: "cancel" },
        {
          text: intl.formatMessage({ id: "common.actions.delete" }),
          style: "destructive",
          onPress: onDelete,
        },
      ]
    );
  }, [close, intl, recipeName, onDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      if (next > 0) {
        translateX.value = next * OVERSHOOT_FACTOR;
      } else if (next < -leftActionsWidth) {
        translateX.value = -leftActionsWidth + (next + leftActionsWidth) * OVERSHOOT_FACTOR;
      } else {
        translateX.value = next;
      }
    })
    .onEnd((e) => {
      const x = translateX.value;
      const vx = e.velocityX;

      if (vx > 200) {
        translateX.value = withSpring(0, SPRING);
        isOpen.value = false;
        return;
      }

      if (vx < -400 || x < -leftActionsWidth * 0.4) {
        translateX.value = withSpring(-leftActionsWidth, SPRING);
        isOpen.value = true;
        return;
      }

      translateX.value = withSpring(0, SPRING);
      isOpen.value = false;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isOpen.value) {
      translateX.value = withSpring(0, SPRING);
      isOpen.value = false;
    }
  });

  const combinedGesture = Gesture.Race(panGesture, tapGesture);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftProgress = useSharedValue(0);

  const leftActionsStyle = useAnimatedStyle(() => {
    const p = interpolate(translateX.value, [-leftActionsWidth, 0], [1, 0], "clamp");
    leftProgress.value = p;
    return { opacity: p > 0 ? 1 : 0 };
  });

  const actionTotal = onDelete ? 3 : 2;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.leftActions, leftActionsStyle]}>
        <ActionButton
          icon="cart-outline"
          color="#3b82f6"
          progress={leftProgress}
          index={0}
          total={actionTotal}
          onPress={handleGroceries}
        />
        <ActionButton
          icon="calendar-outline"
          color="#f59e0b"
          progress={leftProgress}
          index={1}
          total={actionTotal}
          onPress={handleCalendar}
        />
        {onDelete ? (
          <ActionButton
            icon="trash-outline"
            color="#ef4444"
            progress={leftProgress}
            index={2}
            total={actionTotal}
            onPress={handleDelete}
          />
        ) : null}
      </Animated.View>

      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

export const SwipeableRecipeRow = React.forwardRef(SwipeableRecipeRowComponent);
