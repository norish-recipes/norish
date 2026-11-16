import React from "react";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { AccessoryProps } from "../utils/accessory-plan";
import { AccessoryAction } from "./accessory-action";

/** The tab bar's bottom accessory on Calendar: Plan recipe opens the plan sheet with its day picker. */
export function PlanRecipeAccessory({ inline }: AccessoryProps) {
  const intl = useIntl();
  const router = useRouter();

  return (
    <AccessoryAction
      icon="calendar-outline"
      inline={inline}
      label={intl.formatMessage({ id: "calendar.mobile.planRecipe" })}
      testID="plan-recipe-accessory"
      onPress={() => router.push(TAB_ROUTES.calendar.planRecipe)}
    />
  );
}
