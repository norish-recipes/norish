"use client";

import { useState } from "react";
import Panel from "@/components/Panel/Panel";
import UiSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Section } from "@/components/shared/section";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { IngredientFilters } from "@norish/shared-react/ingredients";
import { DEFAULT_INGREDIENT_FILTERS } from "@norish/shared-react/ingredients";
import {
  INGREDIENT_SEARCH_FIELDS,
  INGREDIENT_SEARCH_MATCHES,
  toggleIngredientSearchField,
} from "@norish/shared/lib/ingredient-search";

function ToggleChip({
  selected,
  onPress,
  testId,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  testId: string;
  children: string;
}) {
  return (
    <button
      aria-pressed={selected}
      className="focus-visible:ring-focus shrink-0 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:outline-none"
      data-testid={testId}
      type="button"
      onClick={onPress}
    >
      <Chip
        className="pointer-events-none h-9 px-3 text-xs select-none"
        color={selected ? "accent" : "default"}
        size="sm"
        variant={selected ? "primary" : "tertiary"}
      >
        {children}
      </Chip>
    </button>
  );
}

/** The page's filters, like the dashboard's: they land with Apply; Reset applies the defaults. */
export function IngredientFiltersPanel({
  open,
  value,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  value: IngredientFilters;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: IngredientFilters) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tFilters = useTranslations("common.filters");
  const tActions = useTranslations("common.actions");
  const [working, setWorking] = useState<IngredientFilters>(value);
  const [seededFor, setSeededFor] = useState({ open, value });

  // Opening starts from what is applied, so a change abandoned with Close is gone.
  if (seededFor.open !== open || seededFor.value !== value) {
    setSeededFor({ open, value });
    if (open) setWorking(value);
  }

  const close = () => onOpenChange(false);
  const apply = (filters: IngredientFilters) => {
    onApply(filters);
    close();
  };

  return (
    <Panel open={open} title={tFilters("title")} onOpenChange={onOpenChange}>
      {open ? (
        <Panel.Body sections>
          <Section placement="panel" title={t("searchMatch")}>
            <div className="flex flex-wrap gap-1.5">
              {INGREDIENT_SEARCH_MATCHES.map((match) => (
                <ToggleChip
                  key={match}
                  selected={working.match === match}
                  testId={`ingredients-search-match-${match}`}
                  onPress={() => setWorking({ ...working, match })}
                >
                  {t(`searchMatches.${match}`)}
                </ToggleChip>
              ))}
            </div>
          </Section>

          <Section placement="panel" title={t("searchIn")}>
            <div className="flex flex-wrap gap-1.5">
              {INGREDIENT_SEARCH_FIELDS.map((field) => (
                <ToggleChip
                  key={field}
                  selected={working.fields.includes(field)}
                  testId={`ingredients-search-field-${field}`}
                  onPress={() =>
                    setWorking({
                      ...working,
                      fields: toggleIngredientSearchField(working.fields, field),
                    })
                  }
                >
                  {t(`searchFields.${field}`)}
                </ToggleChip>
              ))}
            </div>
          </Section>

          <Section placement="panel" title={t("layoutSection")}>
            <UiSwitch
              data-testid="ingredients-as-tree"
              isSelected={working.tree}
              onValueChange={(tree) => setWorking({ ...working, tree })}
            >
              <span className="text-sm">{t("asTree")}</span>
            </UiSwitch>
          </Section>

          <Section placement="panel" title={t("showOnly")}>
            <UiSwitch
              data-testid="ingredients-flagged-only"
              isSelected={working.flaggedOnly}
              onValueChange={(flaggedOnly) => setWorking({ ...working, flaggedOnly })}
            >
              <span className="text-sm">{t("flaggedOnly")}</span>
            </UiSwitch>
            <UiSwitch
              data-testid="ingredients-standalone-only"
              isSelected={working.standaloneOnly}
              onValueChange={(standaloneOnly) => setWorking({ ...working, standaloneOnly })}
            >
              <span className="text-sm">{t("standaloneOnly")}</span>
            </UiSwitch>
          </Section>
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup
            start={
              <ActionButton action="reset" onPress={() => apply(DEFAULT_INGREDIENT_FILTERS)}>
                {tActions("reset")}
              </ActionButton>
            }
          >
            <ActionButton
              action="apply"
              data-testid="ingredients-filters-apply"
              onPress={() => apply(working)}
            >
              {tActions("apply")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}
