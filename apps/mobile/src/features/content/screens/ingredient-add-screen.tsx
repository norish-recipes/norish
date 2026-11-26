import React from "react";
import { Card, CardRow } from "@/components/card";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { Section } from "@/components/section";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import {
  INGREDIENT_NAME_MAX,
  useIngredientAdd,
  useIngredientIcons,
} from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** Add a food to the household's catalogue: the foods the name finds are listed as you type, and
 * Add is there only when none has that name. The food it answers, new or found, opens its sheet. */
export function IngredientAddScreen() {
  const text = useText();
  const router = useRouter();
  const { locale } = useIntl();
  const add = useIngredientAdd(locale);
  const rows = add.matches.map((match) => ({ foodId: match.id }));
  const openFood = (id: string) =>
    router.replace({ pathname: "/settings/ingredient", params: { id } });

  useIngredientIcons(rows.map((row) => row.foodId));

  return (
    <Sheet
      confirm={{
        label: text("common.actions.add"),
        disabled: !add.canAdd,
        onPress: async () => {
          const added = await add.add();

          if (added) openFood(added.ingredient.id);
        },
      }}
      name="ingredient-add"
      title={text("settings.content.panel.addTitle.ingredient")}
    >
      <SheetBody>
        <SheetInput
          accessibilityLabel={text("settings.content.panel.name")}
          autoCapitalize="none"
          returnKeyType="done"
          testID="ingredient-add-name"
          value={add.typed}
          onChangeText={add.setTyped}
          onClear={() => add.setTyped("")}
        />
        {add.tooLong ? (
          <SheetNote tone="problem">
            {text("settings.content.panel.tooLong", { max: INGREDIENT_NAME_MAX })}
          </SheetNote>
        ) : null}
        {add.failed ? (
          <SheetNote tone="problem">{text("settings.content.panel.failed")}</SheetNote>
        ) : null}
        {add.matches.length > 0 ? (
          <Section title={text("settings.content.panel.already.ingredient")}>
            <IngredientIconSlots rows={rows}>
              <Card>
                {add.matches.map((match, index) => (
                  <CardRow
                    key={match.id}
                    first={index === 0}
                    label={ingredientDisplayName(match, locale)}
                    media={<IngredientIcon ingredientId={match.id} />}
                    testID="content-add-match"
                    onPress={() => openFood(match.id)}
                  />
                ))}
              </Card>
            </IngredientIconSlots>
          </Section>
        ) : null}
        {add.offline ? <SheetNote>{text("settings.content.offline")}</SheetNote> : null}
      </SheetBody>
    </Sheet>
  );
}
