"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { SelectableRow } from "@/components/cookbooks/selectable-row";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useCookbookMemberIdsQuery, useCookbooksMutations } from "@/hooks/cookbooks";
import { useRecipesQuery } from "@/hooks/recipes";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Button, Input, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

/** Tall enough that the list is the panel rather than a strip under a field. */
const PANEL_HEIGHT = "h-[75dvh]";

/**
 * Fill a cookbook from the cookbook's side.
 *
 * Filing has only ever worked one recipe at a time, from the recipe — which is
 * the right door when the thought starts at a recipe, and the wrong one when
 * it starts at the cookbook and there are eight things to put in it. This is
 * the same question asked from the other end, with the same ticked rows and
 * the same Save.
 *
 * A list titled "Add recipes" offers what can be added, so what the cookbook
 * already holds is left out of it — which needs the member ids for the whole
 * cookbook rather than for a page of it, since the reader may be searching
 * anywhere in a long list. Taking recipes out stays in the edit panel: ticks
 * that could also remove would be two controls wearing one coat.
 */
export function CookbookAddRecipesPanel({
  cookbook,
  open,
  onOpenChange,
}: {
  cookbook: CookbookSummaryDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const { setMembership } = useCookbooksMutations();
  const [rawInput, setRawInput] = useState("");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const { recipes, isLoading, hasMore, loadMore } = useRecipesQuery(
    { search: search || undefined },
    { enabled: open }
  );
  const { memberIds, isLoading: isLoadingMembers } = useCookbookMemberIdsQuery(cookbook.id, {
    enabled: open,
  });
  const members = useMemo(() => new Set(memberIds), [memberIds]);
  const addable = useMemo(
    () => recipes.filter((recipe) => !members.has(recipe.id)),
    [recipes, members]
  );

  useEffect(() => {
    if (!open) {
      setRawInput("");
      setSearch("");
      setSelected([]);
    }
  }, [open]);

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setRawInput(value);
    // Re-querying the whole recipe list is not work the keystroke should wait
    // on, so the field stays responsive while the results catch up.
    startTransition(() => setSearch(value.trim()));
  };

  const toggle = useCallback((recipeId: string) => {
    setSelected((previous) =>
      previous.includes(recipeId)
        ? previous.filter((id) => id !== recipeId)
        : [...previous, recipeId]
    );
  }, []);

  const save = useCallback(() => {
    for (const recipeId of selected) {
      setMembership({ cookbookId: cookbook.id, recipeId, isMember: true, cookbook });
    }

    onOpenChange(false);
  }, [selected, setMembership, cookbook, onOpenChange]);

  return (
    <Panel
      open={open}
      panelClassName={PANEL_HEIGHT}
      title={t("addRecipesTitle", { title: cookbook.title })}
      onOpenChange={onOpenChange}
    >
      {open ? (
        <Panel.Body className="flex min-h-0 flex-1 flex-col">
          <Input
            fullWidth
            data-testid="cookbook-recipe-search"
            placeholder={t("searchRecipes")}
            style={{ fontSize: "16px" }}
            value={rawInput}
            variant="secondary"
            onChange={handleSearch}
          />

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {isLoading || isLoadingMembers ? (
              <div className="flex h-full items-center justify-center py-6">
                <Spinner color="accent" size="sm" />
              </div>
            ) : addable.length === 0 ? (
              <div className="text-muted flex h-full items-center justify-center px-4 text-center text-base">
                {recipes.length > 0 ? t("everythingAlreadyIn") : t("noRecipesToAdd")}
              </div>
            ) : (
              <div className="divide-border/40 flex flex-col divide-y">
                {addable.map((recipe) => (
                  <SelectableRow
                    key={recipe.id}
                    data-add-recipe={recipe.name}
                    isSelected={selected.includes(recipe.id)}
                    media={
                      recipe.image ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          src={recipe.image}
                        />
                      ) : (
                        <PhotoIcon aria-hidden className="h-5 w-5 opacity-70" />
                      )
                    }
                    title={recipe.name}
                    onToggle={() => toggle(recipe.id)}
                  />
                ))}

                {hasMore && (
                  <Button
                    className="mt-2 self-center"
                    size="sm"
                    variant="tertiary"
                    onPress={loadMore}
                  >
                    {t("showMore")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton
              action="add"
              data-testid="save-cookbook-recipes"
              isDisabled={selected.length === 0}
              onPress={save}
            >
              {selected.length > 0 ? t("addCount", { count: selected.length }) : tActions("add")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}
