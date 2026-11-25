"use client";

import type { SetStateAction } from "react";
import { useState } from "react";

import type { FullRecipeDTO, MeasurementSystem, RecipeCategory } from "@norish/shared/contracts";

import type { RecipeEditorMode, RecipeFormErrors, RecipeFormState } from "./recipe-editor";
import type { LineMoves } from "./recipe-editor-rows";
import { useUnitsQuery } from "../config";
import {
  builtInsFirst,
  hasName,
  useEntryCreatePending,
  useListEntries,
  useListRecipeId,
} from "../lists";
import { useHydrated } from "../platform/use-hydrated";
import { useDevicePreference } from "../reader";
import {
  detectFormSystem,
  editorIngredientsOf,
  editorStepsOf,
  initialRecipeForm,
  isRecipeFormDirty,
  recipeFormPayload,
  validateRecipeForm,
} from "./recipe-editor";
import { remapStepRefs } from "./recipe-editor-rows";

interface UseRecipeEditorFormOptions {
  mode: RecipeEditorMode;
  initialData?: FullRecipeDTO;
  /** The reader's language, for the units the lines show. */
  locale: string;
}

/** The recipe editor's form: its fields, the lines and steps seeded once the units load, the
 * detected system of a new recipe, the Categories offered, validation and the save payload. */
export function useRecipeEditorForm({ mode, initialData, locale }: UseRecipeEditorFormOptions) {
  const { units, isLoading: isLoadingUnits } = useUnitsQuery();
  // The list of the recipe's own household, which is another's when its edit policy allows.
  const listRecipeId = useListRecipeId(mode === "edit" ? initialData : undefined);
  const { entries: categoryEntries } = useListEntries("category", listRecipeId);
  const isCreatingEntry = useEntryCreatePending();
  const [unitStyle] = useDevicePreference("unitStyle");
  // False on the server and while hydrating, so the browser's first render matches the server's.
  const isHydrated = useHydrated();
  const [form, setForm] = useState<RecipeFormState>(() => initialRecipeForm(initialData));
  const [errors, setErrors] = useState<RecipeFormErrors & { submit?: string }>({});
  const [initializedRecipeId, setInitializedRecipeId] = useState<string | null>(null);
  const [detectedSystem, setDetectedSystem] = useState<MeasurementSystem | null>(null);
  const [manuallySetSystem, setManuallySetSystem] = useState(false);
  const [detectedFor, setDetectedFor] = useState({
    ingredients: form.ingredients,
    manuallySetSystem,
    isLoadingUnits,
  });
  const labeller = { locale, units, unitStyle };

  // An updater reads the field as it is now, for a write that lands after an await.
  const set = <K extends keyof RecipeFormState>(
    key: K,
    value: SetStateAction<RecipeFormState[K]>
  ) =>
    setForm((prev) => ({
      ...prev,
      [key]:
        typeof value === "function"
          ? (value as (current: RecipeFormState[K]) => RecipeFormState[K])(prev[key])
          : value,
    }));

  // An edit seeds its lines and steps once, in the active system, when the units are known.
  if (
    isHydrated &&
    mode === "edit" &&
    initialData &&
    !isLoadingUnits &&
    initializedRecipeId !== initialData.id
  ) {
    setForm((prev) => ({
      ...prev,
      ingredients: editorIngredientsOf(initialData, labeller),
      steps: editorStepsOf(initialData),
    }));
    setInitializedRecipeId(initialData.id);
  }

  // A new recipe takes the system its lines read as; an existing one keeps its own, as
  // re-detecting could flip it on save.
  if (
    detectedFor.ingredients !== form.ingredients ||
    detectedFor.manuallySetSystem !== manuallySetSystem ||
    detectedFor.isLoadingUnits !== isLoadingUnits
  ) {
    setDetectedFor({ ingredients: form.ingredients, manuallySetSystem, isLoadingUnits });

    const detected =
      mode === "create" && form.ingredients.length > 0 && !manuallySetSystem
        ? detectFormSystem(form.ingredients, units)
        : null;

    if (detected) {
      setDetectedSystem(detected);
      setForm((prev) => ({
        ...prev,
        systemUsed: detected,
        ingredients: prev.ingredients.some((ing) => ing.systemUsed !== detected)
          ? prev.ingredients.map((ing) => ({ ...ing, systemUsed: detected }))
          : prev.ingredients,
        steps: prev.steps.some((step) => step.systemUsed !== detected)
          ? prev.steps.map((step) => ({ ...step, systemUsed: detected }))
          : prev.steps,
      }));
    }
  }

  /** Keeps every step's references on their lines when lines move or go. */
  const moveLines = (moves: LineMoves) =>
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => ({
        ...step,
        stepIngredients: step.stepIngredients && remapStepRefs(step.stepIngredients, moves),
      })),
    }));

  /** The reader's pick: relabels every line and step, it does not convert. */
  const changeSystem = (systemUsed: MeasurementSystem) => {
    setManuallySetSystem(true);
    setForm((prev) => ({
      ...prev,
      systemUsed,
      ingredients: prev.ingredients.map((ing) => ({ ...ing, systemUsed })),
      steps: prev.steps.map((step) => ({ ...step, systemUsed })),
    }));
  };

  // The list, built-ins first, plus any the recipe carries from elsewhere or was just given.
  const categoryOptions = Array.from(
    new Set([
      ...builtInsFirst(categoryEntries).map((entry) => entry.name),
      ...(initialData?.categories ?? []),
      ...form.categories,
    ])
  );
  const toggleCategory = (category: RecipeCategory) =>
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  // An entry of the list, picked or just created: the picker makes new ones, a save makes none.
  const addCategory = (name: string) =>
    setForm((prev) =>
      hasName(prev.categories, name) ? prev : { ...prev, categories: [...prev.categories, name] }
    );

  const isReady = mode !== "edit" || !initialData || initializedRecipeId === initialData.id;
  const hasUnsavedChanges = isReady && isRecipeFormDirty(form, mode, initialData, labeller);

  /** Validates and, when the form may be saved, hands back what to send. A save waits for an
   * entry being created, or it would leave that entry out. */
  const submit = () => {
    if (isCreatingEntry) return null;

    const found = validateRecipeForm(form);

    setErrors(found);
    if (Object.keys(found).length > 0 || form.servings === null) return null;

    return recipeFormPayload({ ...form, servings: form.servings });
  };
  const failSubmit = (message: string) => setErrors({ submit: message });

  return {
    form,
    set,
    listRecipeId,
    isCreatingEntry,
    errors,
    submit,
    failSubmit,
    isReady,
    hasUnsavedChanges,
    detectedSystem,
    changeSystem,
    moveLines,
    categoryOptions,
    toggleCategory,
    addCategory,
  };
}
