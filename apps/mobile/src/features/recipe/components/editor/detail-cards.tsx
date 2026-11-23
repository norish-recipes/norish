import type { ComponentProps } from "react";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { HintButton } from "@/components/hint-button";
import { ServingsStepper } from "@/components/servings-stepper";
import { ToggleChip } from "@/components/toggle-chip";
import { useText } from "@/lib/i18n/use-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeFormState } from "@norish/shared-react/recipes";
import type { RecipeCategory } from "@norish/shared/contracts";
import { useTagsQuery } from "@norish/shared-react/config";
import { servingsDown, servingsUp } from "@norish/shared-react/recipes";

import { SectionCard } from "../tint";
import { EditorInput } from "./editor-parts";

type Set = <K extends keyof RecipeFormState>(key: K, value: RecipeFormState[K]) => void;

/** A removable chip; a dashed one is new to the household. */
export function RemovableChip({
  label,
  dashed = false,
  onRemove,
}: {
  label: string;
  dashed?: boolean;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const [muted, border] = useThemeColor(["muted", "border"] as const);

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage({ id: "recipes.editor.removeNamed" }, { name: label })}
      accessibilityRole="button"
      className={`h-[34px] flex-row items-center gap-1.5 rounded-full px-3 ${dashed ? "" : "bg-default"}`}
      style={dashed ? { borderWidth: 1.5, borderStyle: "dashed", borderColor: border } : undefined}
      onPress={onRemove}
    >
      <Text className="text-foreground text-[15px] font-medium">{label}</Text>
      <Ionicons color={muted} name="close" size={14} />
    </Pressable>
  );
}

/** The chip, ruled by a hairline, that adds one more. */
export function AddChip({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityRole="button"
      className="border-separator h-[34px] flex-row items-center gap-1.5 rounded-full border px-3"
      testID={testID}
      onPress={onPress}
    >
      <Ionicons color={muted} name="add" size={15} />
      <Text className="text-foreground text-[15px] font-medium">{label}</Text>
    </Pressable>
  );
}

export function TagsAndCategoriesCard({
  form,
  set,
  categoryOptions,
  categoryLabel,
  onToggleCategory,
  onAddCategory,
}: {
  form: RecipeFormState;
  set: Set;
  categoryOptions: RecipeCategory[];
  categoryLabel: (category: RecipeCategory) => string;
  onToggleCategory: (category: RecipeCategory) => void;
  onAddCategory: (typed: string) => void;
}) {
  const { tags: known } = useTagsQuery();
  const [draft, setDraft] = useState("");
  const text = useText();
  const has = (tag: string) => form.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  const addTag = (typed: string) => {
    const tag = typed.trim();

    setDraft("");
    if (tag && !has(tag)) set("tags", [...form.tags, tag]);
  };
  const needle = draft.trim().toLowerCase();
  const suggestions = needle
    ? known.filter((tag) => tag.toLowerCase().includes(needle) && !has(tag)).slice(0, 6)
    : [];

  return (
    <SectionCard title={text("recipes.editor.tagsAndCategories")}>
      <View className="gap-2.5 pb-1">
        <Text className="text-muted text-[13px] font-semibold">
          {text("recipes.editor.categories")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {categoryOptions.map((category) => (
            <ToggleChip
              key={category}
              active={form.categories.includes(category)}
              label={categoryLabel(category)}
              testID={`editor-category-${category}`}
              onPress={() => onToggleCategory(category)}
            />
          ))}
          <AddChip
            label={text("recipes.form.addCategory")}
            testID="editor-add-category"
            onPress={() =>
              Alert.prompt(text("recipes.form.addCategory"), undefined, (typed) =>
                onAddCategory(typed)
              )
            }
          />
        </View>
        <View className="mt-2 flex-row items-center gap-1.5">
          <Text className="text-muted text-[13px] font-semibold">
            {text("recipes.editor.tags")}
          </Text>
          <HintButton hint={text("recipes.editor.tagsHint")} />
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          {form.tags.map((tag) => (
            <RemovableChip
              key={tag}
              dashed={!known.includes(tag)}
              label={tag}
              onRemove={() =>
                set(
                  "tags",
                  form.tags.filter((t) => t !== tag)
                )
              }
            />
          ))}
          <EditorInput
            accessibilityLabel={text("recipes.editor.addTag")}
            autoCapitalize="none"
            className="text-foreground h-[34px] min-w-32 flex-1 py-0 text-[15px]"
            placeholder={text("recipes.editor.addTag")}
            returnKeyType="done"
            submitBehavior="submit"
            testID="editor-tag-input"
            value={draft}
            onChangeText={(value) => (/[\s,]$/.test(value) ? addTag(value) : setDraft(value))}
            onSubmitEditing={() => addTag(draft)}
          />
        </View>
        {suggestions.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((tag) => (
              <ToggleChip key={tag} active={false} label={tag} onPress={() => addTag(tag)} />
            ))}
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

/** A number in a filled box with its label above and unit after it. */
function NumberBox({
  label,
  unit,
  value,
  decimal = false,
  testID,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  decimal?: boolean;
  testID: string;
  onChange: (value: number | null) => void;
}) {
  // The typed text is kept while it reads as the same number, so "1." can become "1.5".
  const [typed, setTyped] = useState(value?.toString() ?? "");
  const shown =
    Number(typed) === value || (typed === "" && value === null) ? typed : (value?.toString() ?? "");

  return (
    <View className="bg-default min-w-0 flex-1 gap-0.5 rounded-2xl px-3 py-2.5">
      <Text className="text-muted text-[13px] font-semibold">{label}</Text>
      <View className="flex-row items-baseline gap-1">
        <EditorInput
          accessibilityLabel={label}
          className="text-foreground py-0 text-xl leading-7 font-semibold"
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          placeholder="–"
          style={{ width: Math.max(shown.length, 1) * 12 + 2 }}
          testID={testID}
          value={shown}
          onChangeText={(next) => {
            const normal = next.replace(",", ".");

            setTyped(normal);
            onChange(normal ? (decimal ? parseFloat(normal) : parseInt(normal, 10)) || null : null);
          }}
        />
        <Text className="text-muted text-[13px]">{unit}</Text>
      </View>
    </View>
  );
}

export function ServingsAndTimeCard({
  form,
  set,
  error,
}: {
  form: RecipeFormState;
  set: Set;
  error?: string;
}) {
  const text = useText();
  const minutes = text("recipes.editor.minutes");
  const time = (field: "prepMinutes" | "cookMinutes" | "totalMinutes", id: string) => (
    <NumberBox
      label={text(id)}
      testID={`editor-${field}`}
      unit={minutes}
      value={form[field]}
      onChange={(value) => set(field, value)}
    />
  );

  return (
    <SectionCard title={text("recipes.editor.servingsAndTime")}>
      <View className="flex-row items-center justify-between pb-3">
        <Text className="text-foreground text-[17px]">{text("recipes.form.servings")}</Text>
        <ServingsStepper
          servings={form.servings ?? 1}
          testID="editor-servings"
          onDecrement={() => set("servings", servingsDown(form.servings ?? 1))}
          onIncrement={() => set("servings", servingsUp(form.servings ?? 1))}
        />
      </View>
      {error ? <Text className="text-danger pb-2 text-[13px] font-medium">{error}</Text> : null}
      <View className="flex-row gap-2">
        {time("prepMinutes", "recipes.timeInputs.prep")}
        {time("cookMinutes", "recipes.timeInputs.cook")}
        {time("totalMinutes", "recipes.timeInputs.total")}
      </View>
    </SectionCard>
  );
}

export function NutritionCard({ form, set }: { form: RecipeFormState; set: Set }) {
  const text = useText();
  const box = (
    field: "calories" | "protein" | "carbs" | "fat",
    unit: string,
    decimal: ComponentProps<typeof NumberBox>["decimal"]
  ) => (
    <NumberBox
      decimal={decimal}
      label={text(`recipes.nutrition.${field}`)}
      testID={`editor-${field}`}
      unit={unit}
      value={form[field]}
      onChange={(value) => set(field, value)}
    />
  );
  const grams = text("recipes.editor.grams");

  return (
    <SectionCard
      right={
        <Text className="text-muted flex-1 text-[13px]">{text("recipes.editor.perServing")}</Text>
      }
      title={text("recipes.nutrition.title")}
    >
      <View className="gap-2">
        <View className="flex-row gap-2">
          {box("calories", text("recipes.editor.kcal"), false)}
          {box("protein", grams, true)}
        </View>
        <View className="flex-row gap-2">
          {box("carbs", grams, true)}
          {box("fat", grams, true)}
        </View>
      </View>
    </SectionCard>
  );
}
