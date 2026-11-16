import React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { TimerCapsule } from "@/components/timer-capsule";
import { sprung } from "@/lib/motion/spring";

import type { AccessoryPlan } from "../utils/accessory-plan";
import { AccessoryAction } from "./accessory-action";
import { AddRecipeAccessory } from "./add-recipe-accessory";

/** The accessory's row for `path`: the action, cross-fading when it changes, and the timer
 * capsule springing in beside it. */
export function ShellAccessory({
  path,
  plan: { add, capsule },
}: {
  path: string;
  plan: AccessoryPlan;
}) {
  return (
    <Animated.View className="h-full flex-row items-center justify-center">
      {add ? (
        <Animated.View className="h-full flex-1" layout={sprung(LinearTransition.springify())}>
          {/* Keyed by the action, the old one fades out over the new; Reduce Motion swaps them. */}
          <Animated.View
            key={add === "addRecipe" ? add : add.testID}
            entering={sprung(FadeIn.springify())}
            exiting={sprung(FadeOut.springify())}
            style={StyleSheet.absoluteFill}
          >
            {add === "addRecipe" ? (
              <AddRecipeAccessory path={path} />
            ) : (
              <AccessoryAction action={add} />
            )}
          </Animated.View>
        </Animated.View>
      ) : null}
      {capsule ? (
        <Animated.View entering={sprung(ZoomIn.springify())} exiting={sprung(ZoomOut.springify())}>
          <TimerCapsule divided={!!add} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
