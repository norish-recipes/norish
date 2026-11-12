import React, { useEffect } from "react";
import { Text, View } from "react-native";
import {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { FieldError, useThemeColor } from "heroui-native";

/** A failed attempt; each one is a new object, so the same message shakes again. */
export type InlineErrorState = { message: string } | null;

const RISE_IN = FadeInDown.duration(240)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ transform: [{ translateY: 16 }] });
// Reanimated snaps every animation under Reduce Motion, so the plain fade opts out of that.
const FADE_IN = FadeIn.duration(240).reduceMotion(ReduceMotion.Never);
const SHAKE_OFFSETS = [-10, 9, -7, 5, -3, 0];

/** One shake and one error haptic per failed attempt; Reduce Motion keeps only the haptic. */
export function useErrorShake(error: InlineErrorState) {
  const offset = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!error) return;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    if (!reduceMotion) {
      offset.set(withSequence(...SHAKE_OFFSETS.map((to) => withTiming(to, { duration: 50 }))));
    }
  }, [error, offset, reduceMotion]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
}

/** The danger line under a field or form, rising in when an attempt fails. */
export function InlineError({ error }: { error: InlineErrorState }) {
  const [dangerColor] = useThemeColor(["danger"] as const);
  const reduceMotion = useReducedMotion();

  return (
    <FieldError
      animation={{ entering: { value: reduceMotion ? FADE_IN : RISE_IN } }}
      isInvalid={error !== null}
    >
      <View className="flex-row items-start gap-1.5 pl-1">
        <Feather color={dangerColor} name="alert-circle" size={16} style={{ marginTop: 2 }} />
        <Text className="text-danger flex-1 text-sm font-normal">{error?.message}</Text>
      </View>
    </FieldError>
  );
}
