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
import { NativeTabs } from "expo-router/native-tabs";

import type { AccessoryPlan, AccessoryProps, AddAction } from "../utils/accessory-plan";
import { AddGroceriesAccessory } from "./add-groceries-accessory";
import { AddRecipeAccessory } from "./add-recipe-accessory";
import { CookAccessory } from "./cook-accessory";
import { PlanRecipeAccessory } from "./plan-recipe-accessory";

const ADD: Record<AddAction, React.ComponentType<AccessoryProps>> = {
  recipes: AddRecipeAccessory,
  groceries: AddGroceriesAccessory,
  calendar: PlanRecipeAccessory,
  cook: CookAccessory,
};

/** The accessory's row for `path`: the action, cross-fading when it changes, and the timer
 * capsule springing in beside it. */
export function ShellAccessory({
  path,
  plan: { add, capsule },
}: {
  path: string;
  plan: AccessoryPlan;
}) {
  const Add = add ? ADD[add] : null;
  const inline = NativeTabs.BottomAccessory.usePlacement() === "inline";

  return (
    <Animated.View className="h-full flex-row items-center justify-center">
      {Add ? (
        <Animated.View className="h-full flex-1" layout={sprung(LinearTransition.springify())}>
          {/* Keyed by the action, the old one fades out over the new; Reduce Motion swaps them. */}
          <Animated.View
            key={add}
            entering={sprung(FadeIn.springify())}
            exiting={sprung(FadeOut.springify())}
            style={StyleSheet.absoluteFill}
          >
            <Add inline={inline} path={path} />
          </Animated.View>
        </Animated.View>
      ) : null}
      {capsule ? (
        <Animated.View entering={sprung(ZoomIn.springify())} exiting={sprung(ZoomOut.springify())}>
          <TimerCapsule divided={!!Add} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
