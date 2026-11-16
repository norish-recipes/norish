import React from "react";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { AccessoryProps } from "../utils/accessory-plan";
import { AccessoryAction } from "./accessory-action";

/** The tab bar's bottom accessory on Groceries: Add items opens the add sheet. */
export function AddGroceriesAccessory({ inline }: AccessoryProps) {
  const intl = useIntl();
  const router = useRouter();

  return (
    <AccessoryAction
      icon="add-circle-outline"
      inline={inline}
      label={intl.formatMessage({ id: "groceries.page.addItems" })}
      testID="add-grocery"
      onPress={() => router.push(TAB_ROUTES.groceries.add)}
    />
  );
}
