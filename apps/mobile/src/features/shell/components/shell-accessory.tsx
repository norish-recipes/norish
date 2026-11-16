import React from "react";
import Animated, { LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";
import { TimerCapsule } from "@/components/timer-capsule";
import { sprung } from "@/lib/motion/spring";

import type { AddAction } from "../utils/accessory-plan";
import { AddGroceriesAccessory } from "./add-groceries-accessory";
import { AddRecipeAccessory } from "./add-recipe-accessory";
import { PlanRecipeAccessory } from "./plan-recipe-accessory";

const ADD = {
  recipes: AddRecipeAccessory,
  groceries: AddGroceriesAccessory,
  calendar: PlanRecipeAccessory,
};

/** The accessory's row: the tab's add action, and the timer capsule springing in beside it. */
export function ShellAccessory({ add, capsule }: { add: AddAction | null; capsule: boolean }) {
  const Add = add ? ADD[add] : null;

  return (
    <Animated.View className="h-full flex-row items-center justify-center">
      {Add ? (
        <Animated.View className="h-full flex-1" layout={sprung(LinearTransition.springify())}>
          <Add />
        </Animated.View>
      ) : null}
      {capsule ? (
        <Animated.View entering={sprung(ZoomIn.springify())} exiting={sprung(ZoomOut.springify())}>
          <TimerCapsule />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
