import { useIntl } from "react-intl";

import { servingsDown } from "@norish/shared-react/recipes";

/** The `Stepper` props that say what a servings stepper steps and whether it can. */
export function useServingsStepper(servings: number) {
  const intl = useIntl();

  return {
    canDecrement: servingsDown(servings) !== servings,
    decreaseLabel: intl.formatMessage({ id: "recipes.detail.decreaseServings" }),
    increaseLabel: intl.formatMessage({ id: "recipes.detail.increaseServings" }),
  };
}
