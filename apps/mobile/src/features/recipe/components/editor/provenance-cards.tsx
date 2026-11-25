import React from "react";
import { Pressable, Text, View } from "react-native";
import { HintButton } from "@/components/hint-button";
import { useText } from "@/lib/i18n/use-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProvenanceFormValue } from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import { chosenEntries, useListEntries } from "@norish/shared-react/lists";
import { countryFlagEmoji, listCountryOptions } from "@norish/shared/lib/recipe-provenance";

import { SectionCard } from "../tint";
import { choiceRoute, requestChoice } from "./choice-request";
import { AddChip, RemovableChip } from "./detail-cards";
import { EditorField, EditorInput } from "./editor-parts";

/** Country, region, cuisines and a note, as one atomic group. */
export function ProvenanceCard({
  value,
  onChange,
  recipeId,
  carriedCuisines,
}: {
  value: ProvenanceFormValue;
  onChange: (value: ProvenanceFormValue) => void;
  /** The recipe being edited, once it exists: its household's Cuisines are the ones offered. */
  recipeId?: string;
  /** The Cuisines the recipe carries, which it keeps whatever the list offers. */
  carriedCuisines?: { id: string; name: string }[];
}) {
  const intl = useIntl();
  const { entries: cuisines } = useListEntries("cuisine", recipeId);
  const [muted] = useThemeColor(["muted"] as const);
  const router = useRouter();
  const text = useText();
  const patch = (next: Partial<ProvenanceFormValue>) => onChange({ ...value, ...next });
  const pickCountry = () => {
    const countries = listCountryOptions(intl.locale);

    requestChoice({
      choices: countries.map((option) => ({
        key: option.code,
        label: `${countryFlagEmoji(option.code) ?? ""} ${option.name}`.trim(),
      })),
      selected: value.originCountry ? [value.originCountry] : [],
      // A pick stores the name the editor saw; clearing the country clears it too.
      onChange: ([code]) =>
        patch({
          originCountry: code ?? null,
          originCountryName: code
            ? (countries.find((option) => option.code === code)?.name ?? null)
            : null,
        }),
    });
    router.push(choiceRoute({ name: "editor-country", title: text("recipes.form.originCountry") }));
  };
  const pickCuisines = () => {
    requestChoice({
      choices: [],
      list: { kind: "cuisine", recipeId },
      selected: value.cuisineIds,
      onChange: (cuisineIds) => patch({ cuisineIds }),
    });
    router.push(
      choiceRoute({ name: "editor-cuisine", title: text("recipes.form.cuisines"), multiple: true })
    );
  };
  const flag = countryFlagEmoji(value.originCountry);
  const chosen = chosenEntries(value.cuisineIds, cuisines, carriedCuisines);

  return (
    <SectionCard title={text("recipes.form.provenance")}>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center py-3"
        testID="editor-country"
        onPress={pickCountry}
      >
        <View className="flex-1 gap-1">
          <Text className="text-muted text-[13px] font-semibold">
            {text("recipes.form.originCountry")}
          </Text>
          <Text
            className={`text-[17px] leading-6 ${value.originCountry ? "text-foreground" : "text-muted"}`}
          >
            {value.originCountry
              ? `${flag ? `${flag} ` : ""}${value.originCountryName ?? value.originCountry}`
              : text("recipes.form.originCountryPlaceholder")}
          </Text>
        </View>
        <Ionicons color={muted} name="chevron-forward" size={18} />
      </Pressable>
      <EditorField label={text("recipes.form.originRegion")}>
        <EditorInput
          accessibilityLabel={text("recipes.form.originRegion")}
          placeholder={text("recipes.form.originRegionPlaceholder")}
          testID="editor-region"
          value={value.originRegion}
          onChangeText={(originRegion) => patch({ originRegion })}
        />
      </EditorField>
      <EditorField label={text("recipes.form.cuisines")}>
        <View className="flex-row flex-wrap gap-2 pt-1">
          {chosen.map((cuisine) => (
            <RemovableChip
              key={cuisine.id}
              label={cuisine.name}
              onRemove={() =>
                patch({ cuisineIds: value.cuisineIds.filter((id) => id !== cuisine.id) })
              }
            />
          ))}
          <AddChip
            label={text("common.actions.add")}
            testID="editor-add-cuisine"
            onPress={pickCuisines}
          />
        </View>
      </EditorField>
      <EditorField label={text("recipes.form.provenanceNote")}>
        <EditorInput
          multiline
          accessibilityLabel={text("recipes.form.provenanceNote")}
          placeholder={text("recipes.form.provenanceNotePlaceholder")}
          testID="editor-provenance-note"
          value={value.provenanceNote}
          onChangeText={(provenanceNote) => patch({ provenanceNote })}
        />
      </EditorField>
    </SectionCard>
  );
}

/** The source address and which system the lines are written in. */
export function SourceCard({
  url,
  systemUsed,
  onUrlChange,
  onSystemChange,
}: {
  url: string;
  systemUsed: MeasurementSystem;
  onUrlChange: (url: string) => void;
  onSystemChange: (system: MeasurementSystem) => void;
}) {
  const text = useText();

  return (
    <SectionCard title={text("recipes.editor.source")}>
      <EditorField first label={text("recipes.editor.sourceUrl")}>
        <EditorInput
          accessibilityLabel={text("recipes.editor.sourceUrl")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={text("recipes.form.sourceUrlPlaceholder")}
          testID="editor-url"
          value={url}
          onChangeText={onUrlChange}
        />
      </EditorField>
      <EditorField
        label={
          <View className="flex-row items-center gap-1.5">
            <Text className="text-muted text-[13px] font-semibold">
              {text("recipes.editor.measurementSystem")}
            </Text>
            <HintButton hint={text("recipes.editor.measurementHint")} />
          </View>
        }
      >
        <View className="bg-default mt-1 flex-row rounded-full p-[3px]">
          {(["metric", "us"] as const).map((system) => (
            <Pressable
              key={system}
              accessibilityRole="button"
              accessibilityState={{ selected: systemUsed === system }}
              className={`h-[34px] flex-1 items-center justify-center rounded-full ${systemUsed === system ? "bg-surface shadow-sm" : ""}`}
              testID={`editor-system-${system}`}
              onPress={() => onSystemChange(system)}
            >
              <Text className="text-foreground text-[15px] font-medium">
                {text(`recipes.measurementSystem.${system}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </EditorField>
    </SectionCard>
  );
}
