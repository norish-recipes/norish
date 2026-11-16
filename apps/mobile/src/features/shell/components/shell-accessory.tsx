import React from "react";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { TimerCapsule } from "@/components/timer-capsule";
import {
  SPRING_FADE_IN,
  SPRING_FADE_OUT,
  SPRING_LAYOUT,
  SPRING_ZOOM_IN,
  SPRING_ZOOM_OUT,
} from "@/lib/motion/layout";

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
      <Animated.View className="h-full flex-1" layout={SPRING_LAYOUT}>
        {/* Keyed by the action, the old one fades out over the new; Reduce Motion swaps them. */}
        <Animated.View
          key={add === "addRecipe" ? add : add.testID}
          entering={SPRING_FADE_IN}
          exiting={SPRING_FADE_OUT}
          style={StyleSheet.absoluteFill}
        >
          {add === "addRecipe" ? (
            <AddRecipeAccessory path={path} />
          ) : (
            <AccessoryAction action={add} />
          )}
        </Animated.View>
      </Animated.View>
      {capsule ? (
        <Animated.View entering={SPRING_ZOOM_IN} exiting={SPRING_ZOOM_OUT}>
          <TimerCapsule />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
