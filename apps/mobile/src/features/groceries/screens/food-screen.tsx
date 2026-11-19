import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Switch } from "@/components/switch";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import { useOnTheList, usePantryMutations, usePantryQuery } from "@norish/shared-react/groceries";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { FormCard } from "../components/form-parts";
import { OnTheListChip } from "../components/pantry-rows";

/** A kept food: whether the household keeps it, and nothing else of the Ingredient. */
export function FoodScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, isRead } = usePantryQuery();
  const { removePantryIngredient } = usePantryMutations();
  const item = items.find((candidate) => candidate.id === id) ?? null;
  const onTheList = useOnTheList(item ? [item] : []).length > 0;
  // A draft the Save lands: taking the food out is the only change a kept food has.
  const [keeps, setKeeps] = useState(true);
  const gone = !item && isRead;
  // Save closes the sheet itself; the cache then drops the food and must not close it again.
  const savingRef = useRef(false);

  // Closed once a housemate takes the food out.
  useEffect(() => {
    if (gone && !savingRef.current) router.back();
  }, [gone, router]);

  if (!item) {
    return (
      <Sheet name="pantry-food" title={intl.formatMessage({ id: "groceries.pantry.inYourPantry" })}>
        <SheetBody>
          <Skeleton className="h-14 rounded-[22px]" />
        </SheetBody>
      </Sheet>
    );
  }

  const label = intl.formatMessage({ id: "groceries.pantry.inYourPantry" });
  const save = () => {
    savingRef.current = true;
    if (!keeps) removePantryIngredient(item.id);
    router.back();
  };

  return (
    <Sheet
      confirm={{ label: intl.formatMessage({ id: "common.actions.save" }), onPress: save }}
      name="pantry-food"
      title={ingredientDisplayName(item, intl.locale)}
    >
      <SheetBody>
        <FormCard>
          <View className="h-14 flex-row items-center gap-2.5 px-4">
            <Text className="text-foreground flex-1 text-base">{label}</Text>
            {keeps && onTheList ? <OnTheListChip /> : null}
            <Switch
              accessibilityLabel={label}
              isSelected={keeps}
              testID="pantry-food-switch"
              onSelectedChange={setKeeps}
            />
          </View>
        </FormCard>
      </SheetBody>
    </Sheet>
  );
}
