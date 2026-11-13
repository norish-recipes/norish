import React from "react";
import { Sheet } from "@/components/sheet";
import { useIntl } from "react-intl";

export default function CookbookAddRecipesSheet() {
  const intl = useIntl();

  return (
    <Sheet
      name="cookbook-add-recipes"
      title={intl.formatMessage({ id: "recipes.cookbooks.addRecipes" })}
    />
  );
}
