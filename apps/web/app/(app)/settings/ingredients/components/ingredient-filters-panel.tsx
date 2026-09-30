"use client";

import { useEffect, useState } from "react";
import UiSwitch from "@/app/(app)/settings/components/settings-switch";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type {
  IngredientSearchField,
  IngredientSearchMatch,
} from "@norish/shared/lib/ingredient-search";
import {
  DEFAULT_INGREDIENT_SEARCH_FIELDS,
  DEFAULT_INGREDIENT_SEARCH_MATCH,
  INGREDIENT_SEARCH_FIELDS,
  INGREDIENT_SEARCH_MATCHES,
  toggleIngredientSearchField,
} from "@norish/shared/lib/ingredient-search";

/** How the Ingredients page narrows its list, beyond the text typed. */
export interface IngredientFilters {
  match: IngredientSearchMatch;
  fields: IngredientSearchField[];
  flaggedOnly: boolean;
  /** Only the foods with neither a parent nor kinds: the ones a parent could be found for. */
  standaloneOnly: boolean;
  /** Whether the list is the tree of kinds, or every food flat. */
  tree: boolean;
}

export const DEFAULT_INGREDIENT_FILTERS: IngredientFilters = {
  match: DEFAULT_INGREDIENT_SEARCH_MATCH,
  fields: [...DEFAULT_INGREDIENT_SEARCH_FIELDS],
  flaggedOnly: false,
  standaloneOnly: false,
  tree: true,
};

/** Whether anything differs from the defaults, for the dot on the Filters button. */
export function hasIngredientFilters(filters: IngredientFilters): boolean {
  return (
    filters.flaggedOnly ||
    filters.standaloneOnly ||
    filters.tree !== DEFAULT_INGREDIENT_FILTERS.tree ||
    filters.match !== DEFAULT_INGREDIENT_FILTERS.match ||
    filters.fields.length !== DEFAULT_INGREDIENT_FILTERS.fields.length ||
    filters.fields.some((field) => !DEFAULT_INGREDIENT_FILTERS.fields.includes(field))
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">{children}</h3>
  );
}

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

/**
 * The Ingredients page's filters, in a panel like the dashboard's: how the
 * text is matched, where it is looked for, and whether only the flagged foods
 * show. Changes land with Apply, as they do there; Reset puts the defaults
 * back and applies them.
 */
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

  // Opening starts from what is applied, so a change abandoned with Close is gone.
  useEffect(() => {
    if (open) setWorking(value);
  }, [open, value]);

  const close = () => onOpenChange(false);
  const apply = (filters: IngredientFilters) => {
    onApply(filters);
    close();
  };

  return (
    <Panel open={open} title={tFilters("title")} onOpenChange={onOpenChange}>
      {open ? (
        <Panel.Body className="gap-6">
          <section>
            <SectionTitle>{t("searchMatch")}</SectionTitle>
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
          </section>

          <section>
            <SectionTitle>{t("searchIn")}</SectionTitle>
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
          </section>

          <section>
            <SectionTitle>{t("layoutSection")}</SectionTitle>
            <UiSwitch
              data-testid="ingredients-as-tree"
              isSelected={working.tree}
              onValueChange={(tree) => setWorking({ ...working, tree })}
            >
              <span className="text-sm">{t("asTree")}</span>
            </UiSwitch>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>{t("showOnly")}</SectionTitle>
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
          </section>
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="reset" onPress={() => apply(DEFAULT_INGREDIENT_FILTERS)}>
              {tActions("reset")}
            </ActionButton>
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
