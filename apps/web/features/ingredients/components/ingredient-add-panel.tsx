"use client";

import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import { AddPanel } from "@/components/Panel/add-panel";
import { ListRow } from "@/components/shared/list-row";
import { useLocale, useTranslations } from "next-intl";

import { INGREDIENT_NAME_MAX, useIngredientAdd } from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/**
 * Add a food to the household's catalogue: the foods the name finds are listed as you type, and
 * Add is there only when none has that name. The food it answers, new or found, opens its panel.
 */
export function IngredientAddPanel({
  open,
  onOpenChange,
  onOpenFood,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFood: (id: string) => void;
}) {
  const t = useTranslations("settings.content");
  const locale = useLocale();
  const add = useIngredientAdd(locale);
  let problem: string | null = null;

  if (add.tooLong) problem = t("panel.tooLong", { max: INGREDIENT_NAME_MAX });
  else if (add.failed) problem = t("panel.failed");

  const openFood = (id: string) => {
    onOpenChange(false);
    onOpenFood(id);
  };

  return (
    <AddPanel
      canAdd={add.canAdd}
      matches={add.matches.map((match) => (
        <ListRow
          key={match.id}
          chevron
          data-testid="content-add-match"
          leading={<IngredientIcon placeholder src={match.icon ?? null} />}
          name={ingredientDisplayName(match, locale)}
          onPress={() => openFood(match.id)}
        />
      ))}
      matchesTitle={t("panel.already.ingredient")}
      name={add.typed}
      offline={add.offline}
      open={open}
      problem={problem}
      title={t("panel.addTitle.ingredient")}
      onAdd={() =>
        void add.add().then((added) => {
          if (added) openFood(added.ingredient.id);
        })
      }
      onNameChange={add.setTyped}
      onOpenChange={onOpenChange}
    />
  );
}
