"use client";

import { useMemo } from "react";
import { useCuisinesQuery } from "@/hooks/config";
import { ComboBox, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { listCountryOptions } from "@norish/shared/lib/recipe-provenance";

/** Recipe Provenance as the form holds it: one atomic group. */
export interface ProvenanceFormValue {
  originCountry: string | null;
  /**
   * The country's written name as the editor saw it — the picker label they
   * chose, in their own words — or, untouched, whatever name is stored.
   */
  originCountryName: string | null;
  originRegion: string;
  provenanceNote: string;
  cuisineIds: string[];
}

export const EMPTY_PROVENANCE_FORM_VALUE: ProvenanceFormValue = {
  originCountry: null,
  originCountryName: null,
  originRegion: "",
  provenanceNote: "",
  cuisineIds: [],
};

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
}

/**
 * Edit Recipe Provenance as one group.
 *
 * Every field clears on its own terms: the country by picking its "no country"
 * row, the region and note by emptying them, the Cuisines by deselecting. There
 * is no separate clear-everything action, because each control already says how
 * to empty it.
 *
 * Cuisines are picked from the administrator's vocabulary rather than typed, so
 * an editor's entries land on exactly the rows AI produces. Country is stored as
 * an alpha-2 code, so the picker offers names but records codes.
 */
export default function ProvenanceFields({ value, onChange }: ProvenanceFieldsProps) {
  const locale = useLocale();
  const t = useTranslations("recipes.form");
  const { cuisines } = useCuisinesQuery();
  const countries = useMemo(() => listCountryOptions(locale), [locale]);

  const patch = (changes: Partial<ProvenanceFormValue>) => onChange({ ...value, ...changes });

  const selectedCuisineNames = cuisines
    .filter((cuisine) => value.cuisineIds.includes(cuisine.id))
    .map((cuisine) => cuisine.name);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-base">{t("provenanceHelp")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ComboBox
          selectedKey={value.originCountry}
          onSelectionChange={(key) => {
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
            <Input placeholder={t("originCountryPlaceholder")} variant="secondary" />
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
          <Input placeholder={t("originRegionPlaceholder")} variant="secondary" />
        </TextField>
      </div>

      {/* `value`/`onChange`, not `selectedKeys`/`onSelectionChange`: those are
          the deprecated single-selection props, and a multiple-mode Select
          silently ignores them — it renders as empty however much is chosen. */}
      <Select
        placeholder={t("cuisines")}
        selectionMode="multiple"
        value={value.cuisineIds}
        variant="secondary"
        onChange={(keys) => patch({ cuisineIds: keys.map(String) })}
      >
        <Label>{t("cuisines")}</Label>
        <p className="text-muted text-sm">{t("cuisinesHelp")}</p>
        <Select.Trigger>
          <Select.Value>
            {({ defaultChildren, isPlaceholder }) =>
              isPlaceholder
                ? defaultChildren
                : // Canonical identifiers: shown verbatim in every locale.
                  selectedCuisineNames.join(", ")
            }
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox selectionMode="multiple">
            {cuisines.map((cuisine) => (
              <ListBox.Item key={cuisine.id} id={cuisine.id} textValue={cuisine.name}>
                {cuisine.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <TextField
        aria-label={t("provenanceNote")}
        value={value.provenanceNote}
        onChange={(provenanceNote) => patch({ provenanceNote })}
      >
        <Label>{t("provenanceNote")}</Label>
        <TextArea placeholder={t("provenanceNotePlaceholder")} rows={4} variant="secondary" />
      </TextField>
    </div>
  );
}
