"use client";

import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";

import { usePublicRecipeContext } from "../public/public-recipe-context";
import { ShareServingsControl } from "./share-servings-control";
import { ShareSystemSwitcher } from "./share-system-switcher";

export function ShareRecipeControls() {
  const { state } = usePublicRecipeContext();

  return (
    <>
      <AmountDisplayToggle />
      <ShareServingsControl servings={state.servings} onChange={state.setServings} />
      <ShareSystemSwitcher
        activeSystem={state.activeSystem}
        availableSystems={state.availableSystems}
        onChange={state.setActiveSystem}
      />
    </>
  );
}
