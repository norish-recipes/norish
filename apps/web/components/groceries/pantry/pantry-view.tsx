"use client";

import type { PickedFood } from "@/hooks/pantry";
import { useRef, useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPC } from "@/app/providers/trpc-provider";
import { FIELD_STYLE } from "@/components/groceries/grocery-field";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import { IconActionButton } from "@/components/shared/action-button";
import { useSpellingRules } from "@/hooks/config";
import { useGroceriesQuery } from "@/hooks/groceries";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button, InputGroup, Skeleton, TextField, toast } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";
import { foldName } from "@norish/shared/lib/fold-name";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import {
  groceryOnTheList,
  pantryIngredientFor,
  sortPantryIngredients,
} from "@norish/shared/lib/pantry";
import { foodKey } from "@norish/shared/lib/spelling-keys";

import { FromYourRecipes } from "./from-your-recipes";
import { PutOnTheList, usePutOnTheList } from "./put-on-the-list";

/** How long typing pauses before the catalogue is searched, as in the ingredient picker. */
const SEARCH_DELAY_MS = 250;
/** The catalogue is searched from this many characters on. */
const SEARCH_MIN_LENGTH = 2;
/** How many catalogue foods are offered below the kept ones. */
const CATALOGUE_MATCHES = 8;

/** Whether a kept food goes by a name containing the folded text, in any language. */
function goesBy(item: PantryIngredientDto, needle: string): boolean {
  return [item.name, ...Object.values(item.localeNames)].some((name) =>
    foldName(name).includes(needle)
  );
}

/**
 * The Pantry page's body: the foods the household keeps, by the name the
 * reader reads them in, and one field that both narrows them and finds
 * catalogue foods to add. A row opens the food's Ingredient panel and ends
 * in _Put on the list_, or _On the list_ while a grocery of that same food
 * is still to buy. Enter adds the text as typed, resolved by the server as
 * a typed name always was; picking a catalogue food adds that exact food.
 * Below, "From your recipes" offers what the household's recipes use most.
 */
export function PantryView() {
  const t = useTranslations("groceries.pantry");
  const tStatus = useTranslations("common.status");
  const locale = useLocale();
  const trpc = useTRPC();
  const rules = useSpellingRules();
  const { isOffline } = useConnectivity();
  const { items, isLoading, isUnavailable } = usePantryQuery();
  const { addPantryIngredient } = usePantryMutations();
  const { groceries } = useGroceriesQuery();
  const putOnTheList = usePutOnTheList();
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const typed = draft.trim();
  const [search] = useDebounceValue(typed, SEARCH_DELAY_MS);
  const catalogue = useQuery({
    ...trpc.ingredients.list.queryOptions({ search, locale }),
    enabled: !isOffline && search.length >= SEARCH_MIN_LENGTH,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" data-testid="pantry-loading">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-11 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <p className="text-muted py-6 text-center" data-testid="pantry-unavailable">
        {t("unavailable")}
      </p>
    );
  }

  const keep = (food: string | PickedFood) => {
    const name = typeof food === "string" ? food : ingredientDisplayName(food, locale);

    void addPantryIngredient(food).catch(() =>
      toast(t("keepFailed", { name }), { variant: "danger" })
    );
    setDraft("");
    // The field is where the next food goes, however the last one was added.
    field.current?.focus();
  };

  const duplicate =
    foodKey(draft, rules) !== "" &&
    pantryIngredientFor(items, { ingredientName: draft }, rules) !== null;
  const needle = foldName(draft);
  const kept = sortPantryIngredients(items, locale).filter(
    (item) =>
      needle === "" ||
      goesBy(item, needle) ||
      pantryIngredientFor([item], { ingredientName: draft }, rules) !== null
  );
  const keptIds = new Set(items.map((item) => item.ingredientId));
  // Only the answer for the text in the field: a press on matches for an
  // earlier text, or for the text an add just cleared, would add the wrong food.
  const matches =
    !isOffline && typed.length >= SEARCH_MIN_LENGTH && search === typed
      ? (catalogue.data?.items ?? [])
          .filter((food) => !keptIds.has(food.id))
          .slice(0, CATALOGUE_MATCHES)
      : [];
  const canAdd = foodKey(draft, rules) !== "" && !duplicate;
  const addTyped = () => {
    if (canAdd) keep(typed);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <TextField aria-label={t("fieldLabel")} value={draft} onChange={setDraft}>
          <InputGroup variant="secondary">
            <InputGroup.Prefix>
              <MagnifyingGlassIcon aria-hidden className="text-muted size-4" />
            </InputGroup.Prefix>
            <InputGroup.Input
              ref={field}
              data-testid="pantry-name"
              maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
              placeholder={t("fieldPlaceholder")}
              style={FIELD_STYLE}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTyped();
                }
              }}
            />
            <InputGroup.Suffix className="pr-1">
              <Button
                isIconOnly
                aria-label={t("add")}
                data-testid="add-pantry-ingredient"
                isDisabled={!canAdd}
                size="sm"
                variant="ghost"
                onPress={addTyped}
              >
                <PlusIcon className="size-4" />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
        <p className="text-muted text-sm">{t("hint")}</p>
        {/* A food's details are read from the server, so offline its row opens nothing. */}
        {isOffline ? (
          <p className="text-muted text-sm" data-testid="pantry-offline-details">
            {t("offlineDetails")}
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-muted py-2 text-center" data-testid="pantry-empty">
          {t("empty")}
        </p>
      ) : kept.length === 0 ? (
        <p className="text-muted py-2 text-center" data-testid="pantry-no-match">
          {tStatus("noResults")}
        </p>
      ) : (
        <ul
          className="divide-border divide-y overflow-hidden rounded-lg"
          data-testid="pantry-ingredients"
        >
          {kept.map((item) => {
            const name = ingredientDisplayName(item, locale);

            return (
              <li
                key={item.id}
                className="bg-surface flex min-h-12 items-center gap-3 px-4 py-2"
                data-pantry-ingredient={foldName(item.name)}
              >
                {/* Added offline, a food has no Ingredient to open until it syncs. */}
                {item.ingredientId && !isOffline ? (
                  <button
                    className="min-w-0 flex-1 cursor-[var(--cursor-interactive)] truncate text-left font-medium hover:underline"
                    type="button"
                    onClick={() => setOpenId(item.ingredientId)}
                  >
                    {name}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                )}
                <PutOnTheList
                  onPut={() => putOnTheList(item)}
                  onTheList={groceryOnTheList(groceries, item, rules) !== null}
                />
              </li>
            );
          })}
        </ul>
      )}

      {matches.length > 0 ? (
        <section className="flex flex-col gap-2" data-testid="pantry-catalogue-matches">
          <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
            {t("fromCatalogue")}
          </h2>
          <ul className="divide-border divide-y overflow-hidden rounded-lg">
            {matches.map((food) => {
              const name = ingredientDisplayName(food, locale);

              return (
                <li
                  key={food.id}
                  className="bg-surface flex min-h-12 items-center gap-3 px-4 py-2"
                  data-catalogue-food={food.name}
                >
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <IconActionButton
                    action="add"
                    className="shrink-0"
                    label={t("addFood", { name })}
                    size="sm"
                    variant="tertiary"
                    onPress={() =>
                      keep({
                        ingredientId: food.id,
                        name: food.name,
                        localeNames: food.localeNames,
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <FromYourRecipes items={items} onKeep={keep} />

      <IngredientPanel
        id={openId}
        item={null}
        open={openId !== null}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
