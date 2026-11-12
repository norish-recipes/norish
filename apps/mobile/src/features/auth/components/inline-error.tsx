import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { FADE_IN } from "@/features/auth/utils/motion";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { FieldError, useThemeColor } from "heroui-native";

/** A failed attempt; each one is a new object, so the same message shakes again. */
export type InlineErrorState = { message: string } | null;

const RISE_IN = FadeInDown.duration(240)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ transform: [{ translateY: 16 }] });

const SHAKE_OFFSETS = [-10, 9, -7, 5, -3, 0];

/** Its children, shaking once per failed attempt; still under Reduce Motion. */
export function ErrorShake({
  error,
  className,
  children,
}: {
  error: InlineErrorState;
  className?: string;
  children: ReactNode;
}) {
  const offset = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  useEffect(() => {
    if (error && !reduceMotion) {
      offset.set(withSequence(...SHAKE_OFFSETS.map((to) => withTiming(to, { duration: 50 }))));
    }
  }, [error, offset, reduceMotion]);

  return (
    <Animated.View className={className} style={shakeStyle}>
      {children}
    </Animated.View>
  );
}

/** The danger line under a field or form, rising in with one error haptic per failed attempt. */
export function InlineError({ error, testID }: { error: InlineErrorState; testID?: string }) {
  const [dangerColor] = useThemeColor(["danger"] as const);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (error) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [error]);

  return (
    <FieldError
      animation={{ entering: { value: reduceMotion ? FADE_IN : RISE_IN } }}
      isInvalid={error !== null}
    >
      <View className="flex-row items-start gap-1.5 pl-1">
        <Feather color={dangerColor} name="alert-circle" size={16} style={{ marginTop: 2 }} />
        <Text className="text-danger flex-1 text-sm font-normal" testID={testID}>
          {error?.message}
        </Text>
      </View>
    </FieldError>
  );
}

/** Controls that shake together on each failed attempt, with the error line under them. */
export function InlineErrorBlock({
  error,
  className,
  testID,
  children,
}: {
  error: InlineErrorState;
  className?: string;
  /** The error line's. */
  testID?: string;
  children: ReactNode;
}) {
  return (
    <>
      <ErrorShake className={className} error={error}>
        {children}
      </ErrorShake>
      <InlineError error={error} testID={testID} />
    </>
  );
}
