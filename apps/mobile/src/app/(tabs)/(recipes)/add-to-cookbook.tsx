import React from "react";
import { Sheet } from "@/components/sheet";
import { useIntl } from "react-intl";

export default function AddToCookbookSheet() {
  const intl = useIntl();

  return (
    <Sheet
      name="add-to-cookbook"
      title={intl.formatMessage({ id: "recipes.cookbooks.panelTitle" })}
    />
  );
}
