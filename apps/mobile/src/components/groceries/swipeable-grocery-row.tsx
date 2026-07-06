import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";

/** Width of the revealed action area (houses one circular button). */
const ACTION_WIDTH = 72;
/** Size of the circular delete button — 44px is proportional to most row heights. */
const CIRCLE_SIZE = 44;

const SPRING = { damping: 22, stiffness: 300, mass: 0.8 } as const;
const OVERSHOOT_FACTOR = 0.15;

/** iOS 26 spring — slightly underdamped for organic feel. */
const DELETE_SPRING = { damping: 28, stiffness: 260, mass: 0.9 } as const;

type SwipeableGroceryRowProps = {
  children: React.ReactNode;
  onDelete?: () => void;
};

export function SwipeableGroceryRow({ children, onDelete }: SwipeableGroceryRowProps) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isOpen = useSharedValue(false);

  /** Overlay width — spring-animated from circle size → full row. */
  const overlayWidth = useSharedValue(0);
  /** Content opacity — fades concurrently with expansion. */
  const contentOpacity = useSharedValue(1);
  /** Container opacity — final fade after expansion completes. */
  const containerOpacity = useSharedValue(1);
  /** Tracks whether the delete animation is running. */
  const isDeleting = useSharedValue(false);

  const fireDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    isDeleting.value = true;

    // Snap overlay to circle size instantly so it appears to BE the circle,
    // then spring-expand outward from there.
    overlayWidth.value = CIRCLE_SIZE;
    overlayWidth.value = withSpring(500, DELETE_SPRING);

    // Content fades concurrently
    contentOpacity.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });

    // Phase 2: After expansion settles, fade the whole container
    containerOpacity.value = withDelay(
      280,
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, () => {
        runOnJS(fireDelete)();
      })
    );
  }, [overlayWidth, contentOpacity, containerOpacity, isDeleting, fireDelete]);

  // --- Gestures (same as homepage) ---

  const panGesture = Gesture.Pan()
    .enabled(!!onDelete)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      if (isDeleting.value) return;

      const next = startX.value + e.translationX;
      if (next > 0) {
        translateX.value = next * OVERSHOOT_FACTOR;
      } else if (next < -ACTION_WIDTH) {
        translateX.value = -ACTION_WIDTH + (next + ACTION_WIDTH) * OVERSHOOT_FACTOR;
      } else {
        translateX.value = next;
      }
    })
    .onEnd((e) => {
      if (isDeleting.value) return;

      const x = translateX.value;
      const vx = e.velocityX;

      if (vx > 200) {
        translateX.value = withSpring(0, SPRING);
        isOpen.value = false;
        return;
      }

      if (vx < -400 || x < -ACTION_WIDTH * 0.4) {
        translateX.value = withSpring(-ACTION_WIDTH, SPRING);
        isOpen.value = true;
        return;
      }

      translateX.value = withSpring(0, SPRING);
      isOpen.value = false;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isOpen.value && !isDeleting.value) {
      translateX.value = withSpring(0, SPRING);
      isOpen.value = false;
    }
  });

  const combinedGesture = Gesture.Race(panGesture, tapGesture);

  // --- Animated styles ---

  // Whole container — fades in phase 2
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  // Row content — slides left, fades in phase 1
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: contentOpacity.value,
  }));

  // Swipe-revealed circle button
  const actionProgress = useSharedValue(0);

  const actionAreaStyle = useAnimatedStyle(() => {
    const p = interpolate(translateX.value, [-ACTION_WIDTH, 0], [1, 0], Extrapolation.CLAMP);
    actionProgress.value = p;

    // Hide immediately once delete animation starts
    return {
      opacity: isDeleting.value ? 0 : (p > 0 ? 1 : 0),
    };
  });

  const circleStyle = useAnimatedStyle(() => {
    const p = actionProgress.value;
    const scale = interpolate(p, [0, 0.25, 1], [0.4, 0.85, 1], Extrapolation.CLAMP);
    const opacity = interpolate(p, [0, 0.2], [0, 1], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Overlay pill — expands right-to-left via spring
  const overlayStyle = useAnimatedStyle(() => {
    if (overlayWidth.value === 0) {
      return { width: 0, opacity: 0 };
    }

    return {
      width: overlayWidth.value,
      opacity: 1,
    };
  });

  // Trash icon — stays pinned at the action-area center (right side of row),
  // not inside the expanding overlay. This keeps it stationary.
  const pinnedIconStyle = useAnimatedStyle(() => {
    // Only visible during delete animation
    const opacity = isDeleting.value
      ? interpolate(containerOpacity.value, [0, 0.3, 1], [0, 0.5, 1], Extrapolation.CLAMP)
      : 0;

    return { opacity };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Expanding overlay pill — no icon inside, just the red surface */}
      <View style={styles.overlayAnchor}>
        <Animated.View style={[styles.overlay, overlayStyle]} />
      </View>

      {/* Pinned trash icon — stays centered at the action-area position during delete */}
      <Animated.View style={[styles.pinnedIcon, pinnedIconStyle]}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </Animated.View>

      {/* Action area behind the row (swipe-to-reveal circle) */}
      <Animated.View style={[styles.actionArea, actionAreaStyle]}>
        <Animated.View style={[styles.circleButton, circleStyle]}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Animated.View>
        <Pressable
          onPress={handleDelete}
          style={styles.actionPressable}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        />
      </Animated.View>

      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={[styles.row, rowStyle]}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  row: {
    zIndex: 2,
  },
  actionArea: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  actionPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  circleButton: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayAnchor: {
    position: "absolute",
    // Inset to match the circle button's center position within ACTION_WIDTH
    right: (ACTION_WIDTH - CIRCLE_SIZE) / 2,
    top: 0,
    bottom: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 10,
  },
  overlay: {
    height: CIRCLE_SIZE,
    backgroundColor: "#ef4444",
    borderRadius: CIRCLE_SIZE / 2,
  },
  pinnedIcon: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 11,
  },
});
