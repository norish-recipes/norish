import React from "react";
import { CardSlice } from "@/components/card-slice";
import { useIntl } from "react-intl";

import type { PickedFood } from "@norish/shared-react/groceries";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { PantryAddRow } from "../utils/pantry-add-rows";
import { FoodRow, RowButton } from "./pantry-rows";

/** One row of the Add to pantry sheet: a food it found, or the text as typed; a tap on its + keeps it. */
export function PantryAddRowView({
  row,
  onKeep,
}: {
  row: PantryAddRow;
  onKeep: (food: string | PickedFood) => void;
}) {
  const intl = useIntl();
  const name = row.type === "match" ? ingredientDisplayName(row.food, intl.locale) : row.name;
  const keep = () =>
    onKeep(
      row.type === "match"
        ? { ingredientId: row.food.id, name: row.food.name, localeNames: row.food.localeNames }
        : row.name
    );

  return (
    <CardSlice className="bg-default" edge={row.edge}>
      <FoodRow
        end={
          <RowButton
            accent
            icon="add"
            label={intl.formatMessage({ id: "groceries.pantry.addFood" }, { name })}
            testID={row.type === "match" ? `pantry-match-${row.food.id}` : "pantry-add-custom"}
            onPress={keep}
          />
        }
        ingredientId={row.foodId}
        name={name}
        testID={row.type === "match" ? `pantry-match-row-${row.food.id}` : "pantry-add-custom-row"}
        onPress={keep}
      />
    </CardSlice>
  );
}
