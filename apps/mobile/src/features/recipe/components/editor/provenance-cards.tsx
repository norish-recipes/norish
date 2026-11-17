import React from "react";
import { Pressable, Text, View } from "react-native";
import { HintButton } from "@/components/hint-button";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProvenanceFormValue } from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import { useCuisinesQuery } from "@norish/shared-react/config";
import { countryFlagEmoji, listCountryOptions } from "@norish/shared/lib/recipe-provenance";

import { SectionCard } from "../tint";
import { choiceRoute, requestChoice } from "./choice-request";
import { AddChip, RemovableChip } from "./detail-cards";
import { EditorField, EditorInput } from "./editor-parts";

/** Country, region, cuisines and a note, as one atomic group. */
export function ProvenanceCard({
  value,
  onChange,
}: {
  value: ProvenanceFormValue;
  onChange: (value: ProvenanceFormValue) => void;
}) {
  const intl = useIntl();
  const { cuisines } = useCuisinesQuery();
  const [muted] = useThemeColor(["muted"] as const);
  const router = useRouter();
  const text = (id: string) => intl.formatMessage({ id });
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
      choices: cuisines.map((cuisine) => ({ key: cuisine.id, label: cuisine.name })),
      selected: value.cuisineIds,
      onChange: (cuisineIds) => patch({ cuisineIds }),
    });
    router.push(
      choiceRoute({ name: "editor-cuisine", title: text("recipes.form.cuisines"), multiple: true })
    );
  };
  const flag = countryFlagEmoji(value.originCountry);
  const cuisineName = (id: string) => cuisines.find((cuisine) => cuisine.id === id)?.name ?? id;

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
          {value.cuisineIds.map((id) => (
            <RemovableChip
              key={id}
              label={cuisineName(id)}
              onRemove={() => patch({ cuisineIds: value.cuisineIds.filter((c) => c !== id) })}
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
  const intl = useIntl();
  const text = (id: string) => intl.formatMessage({ id });

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
