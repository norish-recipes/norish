import React from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useIntl } from "react-intl";

export type ListSection = "list" | "pantry";

/** The segments of the switch under the title between the list and the Pantry. */
export function useListSegments() {
  const intl = useIntl();

  return [
    {
      value: "list",
      label: intl.formatMessage({ id: "groceries.page.title" }),
      icon: (color: string | undefined) => (
        <MaterialCommunityIcons color={color} name="clipboard-check-outline" size={20} />
      ),
      testID: "groceries-switch-list",
    },
    {
      value: "pantry",
      label: intl.formatMessage({ id: "groceries.page.pantry" }),
      icon: (color: string | undefined) => (
        <MaterialCommunityIcons color={color} name="archive-outline" size={20} />
      ),
      testID: "groceries-switch-pantry",
    },
  ] as const;
}
