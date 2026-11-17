import React from "react";
import { GlassSegmented } from "@/components/glass-segmented";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useIntl } from "react-intl";

export type ListSection = "list" | "pantry";

/** The glass switch under the title between the list and the Pantry; it scrolls with the page. */
export function ListSwitch({
  value,
  onChange,
}: {
  value: ListSection;
  onChange: (value: ListSection) => void;
}) {
  const intl = useIntl();

  return (
    <GlassSegmented
      segments={[
        {
          value: "list",
          label: intl.formatMessage({ id: "groceries.page.title" }),
          icon: (color) => (
            <MaterialCommunityIcons color={color} name="clipboard-check-outline" size={20} />
          ),
          testID: "groceries-switch-list",
        },
        {
          value: "pantry",
          label: intl.formatMessage({ id: "groceries.page.pantry" }),
          icon: (color) => (
            <MaterialCommunityIcons color={color} name="archive-outline" size={20} />
          ),
          testID: "groceries-switch-pantry",
        },
      ]}
      testID="groceries-switch"
      value={value}
      onChange={onChange}
    />
  );
}
