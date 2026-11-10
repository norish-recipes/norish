"use client";

import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";

import {
  useSharePageStore,
  useShareServings,
  useShareSystem,
  useShareSystems,
} from "../public/share-page-store";
import { ShareServingsControl } from "./share-servings-control";
import { ShareSystemSwitcher } from "./share-system-switcher";

export function ShareRecipeControls() {
  const servings = useShareServings();
  const system = useShareSystem();
  const systems = useShareSystems();
  const setServings = useSharePageStore((state) => state.setServings);
  const setSystem = useSharePageStore((state) => state.setSystem);

  return (
    <>
      <AmountDisplayToggle />
      <ShareServingsControl servings={servings} onChange={setServings} />
      <ShareSystemSwitcher activeSystem={system} availableSystems={systems} onChange={setSystem} />
    </>
  );
}
