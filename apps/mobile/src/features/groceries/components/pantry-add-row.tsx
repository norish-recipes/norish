import React from "react";
import { CardSlice } from "@/components/card-slice";
import { useIntl } from "react-intl";

import type { PickedFood } from "@norish/shared-react/groceries";

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

  return (
    <CardSlice edge={row.edge}>
      <FoodRow
        end={
          <RowButton
            accent
            icon="add"
            label={intl.formatMessage({ id: "groceries.pantry.addFood" }, { name: row.name })}
            testID={row.testIDs.button}
            onPress={() => onKeep(row.keeps)}
          />
        }
        ingredientId={row.foodId}
        name={row.name}
        subline={
          row.recipeCount === null
            ? undefined
            : intl.formatMessage({ id: "groceries.pantry.inRecipes" }, { count: row.recipeCount })
        }
        testID={row.testIDs.row}
        onPress={() => onKeep(row.keeps)}
      />
    </CardSlice>
  );
}
