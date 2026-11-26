"use client";

import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import Panel from "@/components/Panel/Panel";
import { PanelSection } from "@/components/Panel/panel-section";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Input, TextField } from "@heroui/react";
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
  const tActions = useTranslations("common.actions");
  const locale = useLocale();
  const add = useIngredientAdd(locale);
  const close = () => onOpenChange(false);
  let problem: string | null = null;

  if (add.tooLong) problem = t("panel.tooLong", { max: INGREDIENT_NAME_MAX });
  else if (add.failed) problem = t("panel.failed");

  const submit = async () => {
    const added = await add.add();

    if (!added) return;

    close();
    onOpenFood(added.ingredient.id);
  };

  return (
    <Panel open={open} title={t("panel.addTitle.ingredient")} onOpenChange={onOpenChange}>
      <Panel.Body>
        <div className="flex flex-col gap-5">
          {problem ? <Note status="warning">{problem}</Note> : null}
          <PanelSection title={t("panel.name")}>
            <TextField aria-label={t("panel.name")} value={add.typed} onChange={add.setTyped}>
              <Input
                data-testid="content-add-name"
                variant="secondary"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (add.canAdd) void submit();
                  }
                }}
              />
            </TextField>
          </PanelSection>
          {add.matches.length > 0 ? (
            <PanelSection title={t("panel.already.ingredient")}>
              <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
                {add.matches.map((match) => (
                  <li key={match.id}>
                    <button
                      className="hover:bg-default/40 focus-visible:ring-focus flex min-h-12 w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-4 text-start focus-visible:ring-2 focus-visible:outline-none"
                      data-testid="content-add-match"
                      type="button"
                      onClick={() => {
                        close();
                        onOpenFood(match.id);
                      }}
                    >
                      <IngredientIcon placeholder src={match.icon ?? null} />
                      <span className="min-w-0 flex-1 truncate">
                        {ingredientDisplayName(match, locale)}
                      </span>
                      <ChevronRightIcon aria-hidden className="text-muted size-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </PanelSection>
          ) : null}
          {add.offline ? <Note>{t("offline")}</Note> : null}
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup
          start={
            <ActionButton action="cancel" onPress={close}>
              {tActions("cancel")}
            </ActionButton>
          }
        >
          <ActionButton
            action="add"
            data-testid="content-add-submit"
            isDisabled={!add.canAdd}
            onPress={() => void submit()}
          >
            {tActions("add")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
