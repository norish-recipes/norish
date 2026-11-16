import React from "react";
import Animated, { LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";
import { TimerCapsule } from "@/components/timer-capsule";
import { sprung } from "@/lib/motion/spring";
import { NativeTabs } from "expo-router/native-tabs";

import type { AccessoryPlan, AccessoryProps, AddAction } from "../utils/accessory-plan";
import { AddGroceriesAccessory } from "./add-groceries-accessory";
import { AddRecipeAccessory } from "./add-recipe-accessory";
import { PlanRecipeAccessory } from "./plan-recipe-accessory";

const ADD: Record<AddAction, React.ComponentType<AccessoryProps>> = {
  recipes: AddRecipeAccessory,
  groceries: AddGroceriesAccessory,
  calendar: PlanRecipeAccessory,
};

/** The accessory's row: the tab's add action, and the timer capsule springing in beside it. */
export function ShellAccessory({ plan: { add, capsule } }: { plan: AccessoryPlan }) {
  const Add = add ? ADD[add] : null;
  const inline = NativeTabs.BottomAccessory.usePlacement() === "inline";

  return (
    <Animated.View className="h-full flex-row items-center justify-center">
      {Add ? (
        <Animated.View className="h-full flex-1" layout={sprung(LinearTransition.springify())}>
          <Add inline={inline} />
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
