"use client";

import { useMemo } from "react";
import { useCuisinesQuery } from "@/hooks/config";
import { XMarkIcon } from "@heroicons/react/16/solid";
import { Button, ComboBox, Input, Label, ListBox, TextArea, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { listCountryOptions } from "@norish/shared/lib/recipe-provenance";

/** Recipe Provenance as the form holds it: one atomic group. */
export interface ProvenanceFormValue {
  originCountry: string | null;
  originRegion: string;
  provenanceNote: string;
  cuisineIds: string[];
}

export const EMPTY_PROVENANCE_FORM_VALUE: ProvenanceFormValue = {
  originCountry: null,
  originRegion: "",
  provenanceNote: "",
  cuisineIds: [],
};

interface ProvenanceFieldsProps {
  value: ProvenanceFormValue;
  onChange: (value: ProvenanceFormValue) => void;
}

/**
 * Edit Recipe Provenance as one atomic group.
 *
 * Atomicity is deliberate: the note explains the whole claim, so the country,
 * the region, the Cuisines, and the note are edited and cleared together.
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

  const isEmpty =
    value.originCountry === null &&
    value.originRegion.trim() === "" &&
    value.provenanceNote.trim() === "" &&
    value.cuisineIds.length === 0;

  const patch = (changes: Partial<ProvenanceFormValue>) => onChange({ ...value, ...changes });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-base">{t("provenanceHelp")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ComboBox
          selectedKey={value.originCountry}
          onSelectionChange={(key) => patch({ originCountry: key ? String(key) : null })}
        >
          <Label>{t("originCountry")}</Label>
          <ComboBox.InputGroup>
            <Input placeholder={t("originCountryPlaceholder")} variant="secondary" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
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

      <div className="flex flex-col gap-2">
        <Label>{t("cuisines")}</Label>
        <p className="text-muted text-sm">{t("cuisinesHelp")}</p>
        <div className="flex flex-wrap gap-2">
          {cuisines.map((cuisine) => {
            const selected = value.cuisineIds.includes(cuisine.id);

            return (
              <Button
                key={cuisine.id}
                size="sm"
                variant={selected ? "primary" : "tertiary"}
                onPress={() =>
                  patch({
                    cuisineIds: selected
                      ? value.cuisineIds.filter((id) => id !== cuisine.id)
                      : [...value.cuisineIds, cuisine.id],
                  })
                }
              >
                {/* A canonical identifier: shown verbatim in every locale. */}
                {cuisine.name}
              </Button>
            );
          })}
        </div>
      </div>

      <TextField
        aria-label={t("provenanceNote")}
        value={value.provenanceNote}
        onChange={(provenanceNote) => patch({ provenanceNote })}
      >
        <Label>{t("provenanceNote")}</Label>
        <TextArea placeholder={t("provenanceNotePlaceholder")} rows={4} variant="secondary" />
      </TextField>

      <div className="flex justify-end">
        {/* Clearing is an explicit editor action, distinct from an enrichment
            run writing an empty result — which the write path refuses. */}
        <Button
          isDisabled={isEmpty}
          variant="tertiary"
          onPress={() => onChange({ ...EMPTY_PROVENANCE_FORM_VALUE })}
        >
          <XMarkIcon className="h-4 w-4" />
          {t("clearProvenance")}
        </Button>
      </div>
    </div>
  );
}
