"use client";

import { useMemo } from "react";
import { ChipButton } from "@/components/shared/chip-button";
import { EntryComboBox } from "@/components/shared/entry-combo-box";
import { ComboBox, Input, Label, ListBox, TextArea, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { ProvenanceFormValue } from "@norish/shared-react/recipes";
import { chosenEntries, useListEntries } from "@norish/shared-react/lists";
import { listCountryOptions } from "@norish/shared/lib/recipe-provenance";

export {
  EMPTY_PROVENANCE_FORM_VALUE,
  type ProvenanceFormValue,
} from "@norish/shared-react/recipes";

/**
 * The "no country" row's key.
 *
 * Country codes are two letters, so this cannot collide with one — and a real
 * row is what makes emptying the field reachable by keyboard and by screen
 * reader, which a text-clearing gesture alone is not.
 */
const NO_COUNTRY_KEY = "__none__";

interface ProvenanceFieldsProps {
  value: ProvenanceFormValue;
  onChange: (value: ProvenanceFormValue) => void;
  /** The recipe being edited, once it exists: its household's Cuisines are the ones offered. */
  recipeId?: string;
  /** The Cuisines the recipe carries, which it keeps whatever the list offers. */
  carriedCuisines?: { id: string; name: string }[];
}

/**
 * Edit Recipe Provenance as one group.
 *
 * Every field clears on its own terms: the country by picking its "no country"
 * row, the region and note by emptying them, the Cuisines by deselecting. There
 * is no separate clear-everything action, because each control already says how
 * to empty it.
 *
 * Cuisines are picked from the list (the household's and the instance's) as you type, and a
 * new one is made only by the "Create" row. Country is stored as an alpha-2 code, so the
 * picker offers names but records codes.
 */
export default function ProvenanceFields({
  value,
  onChange,
  recipeId,
  carriedCuisines,
}: ProvenanceFieldsProps) {
  const locale = useLocale();
  const t = useTranslations("recipes.form");
  const tEditor = useTranslations("recipes.editor");
  const { entries: cuisines } = useListEntries("cuisine", recipeId);
  const countries = useMemo(() => listCountryOptions(locale), [locale]);

  const patch = (changes: Partial<ProvenanceFormValue>) => onChange({ ...value, ...changes });

  const chosen = chosenEntries(value.cuisineIds, cuisines, carriedCuisines);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-base">{t("provenanceHelp")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ComboBox
          value={value.originCountry}
          onChange={(key) => {
            // A dismissed popover reports a null key; both it and the
            // "no country" row mean the same thing — leave it unset.
            const code = key === null || key === NO_COUNTRY_KEY ? null : String(key);

            patch({
              originCountry: code,
              // A manual pick stores the label the editor saw, in their own
              // words. Clearing the country clears the name with it.
              originCountryName:
                code === null
                  ? null
                  : (countries.find((option) => option.code === code)?.name ?? null),
            });
          }}
        >
          <Label>{t("originCountry")}</Label>
          <ComboBox.InputGroup>
            <Input placeholder={t("originCountryPlaceholder")} />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              {/* The same words as the placeholder, because picking this row and
                  never having picked anything leave the field in one state. */}
              <ListBox.Item id={NO_COUNTRY_KEY} textValue={t("originCountryPlaceholder")}>
                {t("originCountryPlaceholder")}
              </ListBox.Item>
              {countries.map((option) => (
                <ListBox.Item key={option.code} id={option.code} textValue={option.name}>
                  {option.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>

        <TextField
          aria-label={t("originRegion")}
          value={value.originRegion}
          onChange={(originRegion) => patch({ originRegion })}
        >
          <Label>{t("originRegion")}</Label>
          <Input placeholder={t("originRegionPlaceholder")} />
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("cuisines")}</span>
        <p className="text-muted text-sm">{t("cuisinesHelp")}</p>
        {chosen.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {chosen.map((cuisine) => (
              <ChipButton
                key={cuisine.id}
                aria-label={tEditor("removeNamed", { name: cuisine.name })}
                className="h-8 cursor-pointer rounded-full px-3 text-sm"
                color="accent"
                variant="primary"
                onClick={() =>
                  patch({ cuisineIds: value.cuisineIds.filter((id) => id !== cuisine.id) })
                }
              >
                {cuisine.name}
              </ChipButton>
            ))}
          </div>
        ) : null}
        <EntryComboBox
          opensOnFocus
          kind="cuisine"
          label={t("cuisines")}
          placeholder={t("cuisines")}
          recipeId={recipeId}
          isSelected={(entry) => value.cuisineIds.includes(entry.id)}
          onSelect={(entry) => patch({ cuisineIds: [...value.cuisineIds, entry.id] })}
        />
      </div>

      <TextField
        aria-label={t("provenanceNote")}
        value={value.provenanceNote}
        onChange={(provenanceNote) => patch({ provenanceNote })}
      >
        <Label>{t("provenanceNote")}</Label>
        <TextArea placeholder={t("provenanceNotePlaceholder")} rows={4} />
      </TextField>
    </div>
  );
}
