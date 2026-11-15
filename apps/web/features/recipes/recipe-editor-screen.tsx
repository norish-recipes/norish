"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChipButton } from "@/components/shared/chip-button";
import TagInput from "@/components/shared/tag-input";
import IngredientInput from "@/features/recipes/components/editor/ingredient-input";
import MeasurementSystemSelector from "@/features/recipes/components/editor/measurement-system-selector";
import MediaGalleryInput from "@/features/recipes/components/editor/media-gallery-input";
import ProvenanceFields from "@/features/recipes/components/editor/provenance-fields";
import SmartInputHelp from "@/features/recipes/components/editor/smart-input-help";
import SmartTextInput from "@/features/recipes/components/editor/smart-text-input";
import StepInput from "@/features/recipes/components/editor/step-input";
import TimeInputs from "@/features/recipes/components/editor/time-inputs";
import EditRecipeSkeleton from "@/features/recipes/components/skeleton/edit-recipe-skeleton";
import { useUnsavedNavigationGuard } from "@/features/recipes/hooks/use-unsaved-navigation-guard";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { useCategoryLabel } from "@/lib/category-display";
import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { RecipeFormErrors } from "@norish/shared-react/recipes";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  useRecipeEditorForm,
  useRecipeId,
  useRecipeListSubscription,
} from "@norish/shared-react/recipes";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("RecipeEditorScreen");

interface RecipeEditorScreenProps {
  mode: "create" | "edit";
  initialData?: FullRecipeDTO;
}
export function RecipeEditorScreen({ mode, initialData }: RecipeEditorScreenProps) {
  const router = useRouter();
  const { createRecipe, updateRecipe } = useRecipesMutations();
  const locale = useLocale();

  // The ingredient rows draw each food's icon; the list events reread the Categories offered.
  useIngredientsSubscription();
  useRecipeListSubscription();

  const categoryLabel = useCategoryLabel();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("recipes.form");
  const tValidation = useTranslations("recipes.validation");
  const tCommon = useTranslations("common.actions");
  const { recipeId, isLoading: isLoadingRecipeId } = useRecipeId(mode, initialData?.id);
  const editor = useRecipeEditorForm({ mode, initialData, locale });
  const { form, set } = editor;
  const errorText = (field: keyof RecipeFormErrors) => {
    const key = editor.errors[field];

    return key ? tValidation(key) : undefined;
  };
  const errors = {
    name: errorText("name"),
    ingredients: errorText("ingredients"),
    steps: errorText("steps"),
    servings: errorText("servings"),
    submit: editor.errors.submit,
  };
  const [newCategory, setNewCategory] = useState("");

  const navigateBack = () => router.back();
  const {
    allowNavigation,
    confirmNavigation: confirmDiscardChanges,
    disallowNavigation,
  } = useUnsavedNavigationGuard({
    hasUnsavedChanges: editor.hasUnsavedChanges,
    confirmationMessage: t("discardChangesConfirm"),
    onConfirmLeave: navigateBack,
  });
  const handleCancel = () => {
    if (!confirmDiscardChanges()) return;
    allowNavigation();
    navigateBack();
  };
  const addCategory = () => {
    setNewCategory("");
    editor.addCategory(newCategory);
  };
  const handleSubmit = () => {
    const recipeData = editor.submit();

    if (!recipeData) return;
    setIsSubmitting(true);
    const editing = mode === "edit" ? initialData : undefined;

    try {
      if (mode === "create") {
        allowNavigation();
        createRecipe({ ...recipeData, id: recipeId! });
        router.push(`/recipes/${recipeId!}`);
      } else if (editing) {
        allowNavigation();
        updateRecipe(editing.id, { ...recipeData, version: editing.version });
        router.push(`/recipes/${editing.id}`);
      }
    } catch (err) {
      log.error({ err }, "Failed to save recipe");
      disallowNavigation();
      editor.failSubmit((err as Error).message);
    }
    setIsSubmitting(false);
  };
  const handleTimeChange = (
    field: "prepMinutes" | "cookMinutes" | "totalMinutes",
    value: number | null
  ) => set(field, value);

  // Show skeleton while reserving recipe ID for create mode
  if (isLoadingRecipeId) {
    return <EditRecipeSkeleton mode={mode} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden px-4 py-6 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {mode === "create" ? t("createTitle") : t("editTitle")}
            </h1>
            <p className="text-muted mt-2">
              {mode === "create" ? t("createDescription") : t("editDescription")}
            </p>
          </div>
        </div>

        {errors.submit && (
          <div className="bg-danger/10 dark:bg-danger/10 border-danger/30 dark:border-danger/30 text-danger dark:text-danger mt-4 rounded-lg border p-4">
            {errors.submit}
          </div>
        )}
      </div>

      <form className="min-w-0 space-y-10">
        {/* 1. Photos */}
        <section className="min-w-0">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              1
            </span>
            {t("photo")}
          </h2>
          <div className="ml-0 min-w-0 md:ml-9">
            {recipeId && (
              <MediaGalleryInput
                media={form.media}
                recipeId={recipeId}
                onChange={(media) => set("media", media)}
              />
            )}
          </div>
        </section>

        {/* 2. Basic Information */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              2
            </span>
            {t("basicInfo")}
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <TextField
              isRequired
              className="text-lg"
              isInvalid={!!errors.name}
              value={form.name}
              onChange={(value) => set("name", value)}
            >
              <Label>{t("recipeName")}</Label>
              <Input placeholder={t("recipeNamePlaceholder")} />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </TextField>

            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="text-foreground text-sm font-medium">{t("description")}</span>
                <SmartInputHelp />
              </div>
              <SmartTextInput
                minRows={2}
                placeholder={t("descriptionPlaceholder")}
                value={form.description}
                onValueChange={(value) => set("description", value)}
              />
            </div>
          </div>
        </section>

        {/* 3. Ingredients */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              3
            </span>
            {t("ingredients")}
            <span className="text-danger text-lg">*</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <div className="text-muted mb-3 flex items-center gap-1 text-base">
              {t("ingredientsHelp")}
              <SmartInputHelp />
            </div>
            <IngredientInput
              ingredients={form.ingredients}
              systemUsed={form.systemUsed}
              onChange={(ingredients) => set("ingredients", ingredients)}
            />
            {errors.ingredients && (
              <p className="text-danger mt-2 text-base">{errors.ingredients}</p>
            )}
          </div>
        </section>

        {/* 4. Instructions */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              4
            </span>
            {t("instructions")}
            <span className="text-danger text-lg">*</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <div className="text-muted mb-3 flex items-center gap-1 text-base">
              {t("instructionsHelp")}
              <SmartInputHelp showIngredientMention />
            </div>
            <StepInput
              ingredients={form.ingredients}
              recipeId={recipeId ?? undefined}
              steps={form.steps}
              systemUsed={form.systemUsed}
              onChange={(steps) => set("steps", steps)}
            />
            {errors.steps && <p className="text-danger mt-2 text-base">{errors.steps}</p>}
          </div>
        </section>

        {/* 5. Tags & Categories */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              5
            </span>
            {t("tagsAndCategories")}
          </h2>
          <div className="ml-0 space-y-6 md:ml-9">
            <div>
              <p className="text-muted mb-3 text-base">{t("tagsHelp")}</p>
              <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
            </div>
            <div>
              <p className="text-muted mb-3 text-base">{t("categoriesHelp")}</p>
              <div className="flex flex-wrap gap-2">
                {editor.categoryOptions.map((category) => {
                  const active = form.categories.includes(category);

                  return (
                    <ChipButton
                      key={category}
                      aria-pressed={active}
                      className="chip--on-ground h-8 cursor-pointer rounded-full px-3 text-sm"
                      color={active ? "accent" : "default"}
                      variant={active ? "primary" : "tertiary"}
                      onClick={() => editor.toggleCategory(category)}
                    >
                      {categoryLabel(category)}
                    </ChipButton>
                  );
                })}
                <input
                  aria-label={t("addCategory")}
                  className="bg-default text-foreground placeholder:text-muted h-8 w-40 rounded-full border border-(--field-border) px-3 text-sm outline-none"
                  maxLength={40}
                  placeholder={t("addCategory")}
                  style={{ fontSize: "16px" }}
                  type="text"
                  value={newCategory}
                  onBlur={addCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    addCategory();
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 6. Nutrition */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              6
            </span>
            {t("nutrition")}
            <span className="text-muted text-sm font-normal">{t("nutritionPerServing")}</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <TextField
                className="w-full"
                type="number"
                value={form.calories != null ? form.calories.toString() : ""}
                onChange={(value) => set("calories", value ? parseInt(value, 10) || null : null)}
              >
                <Label>{t("calories")}</Label>
                <Input min={0} placeholder="-" />
              </TextField>
              <TextField
                className="w-full"
                type="number"
                value={form.fat != null ? form.fat.toString() : ""}
                onChange={(value) => set("fat", value ? parseFloat(value) || null : null)}
              >
                <Label>{t("fat")}</Label>
                <Input min={0} placeholder="-" step={0.1} />
              </TextField>
              <TextField
                className="w-full"
                type="number"
                value={form.carbs != null ? form.carbs.toString() : ""}
                onChange={(value) => set("carbs", value ? parseFloat(value) || null : null)}
              >
                <Label>{t("carbs")}</Label>
                <Input min={0} placeholder="-" step={0.1} />
              </TextField>
              <TextField
                className="w-full"
                type="number"
                value={form.protein != null ? form.protein.toString() : ""}
                onChange={(value) => set("protein", value ? parseFloat(value) || null : null)}
              >
                <Label>{t("protein")}</Label>
                <Input min={0} placeholder="-" step={0.1} />
              </TextField>
            </div>
          </div>
        </section>

        {/* 7. Provenance */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              7
            </span>
            {t("provenance")}
          </h2>
          <div className="ml-0 md:ml-9">
            <ProvenanceFields
              value={form.provenance}
              onChange={(provenance) => set("provenance", provenance)}
            />
          </div>
        </section>

        {/* 8. Details */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              8
            </span>
            {t("details")}
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                className="w-full"
                isInvalid={!!errors.servings}
                type="number"
                value={form.servings?.toString() ?? ""}
                onChange={(value) => set("servings", parseInt(value, 10) || null)}
              >
                <Label>{t("servings")}</Label>
                <Input min={1} placeholder="1" />
                {errors.servings && <FieldError>{errors.servings}</FieldError>}
              </TextField>
            </div>
            <div>
              <span
                className="text-foreground mb-3 block text-base font-medium"
                id="cooking-times-label"
              >
                {t("cookingTimes")} <span className="text-muted font-normal">{t("optional")}</span>
              </span>
              <TimeInputs
                cookMinutes={form.cookMinutes}
                prepMinutes={form.prepMinutes}
                totalMinutes={form.totalMinutes}
                onChange={handleTimeChange}
              />
            </div>
          </div>
        </section>

        {/* 9. Additional Information */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              9
            </span>
            {t("additionalInfo")}
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="text-foreground text-sm font-medium">{t("notes")}</span>
                <SmartInputHelp />
              </div>
              <SmartTextInput
                minRows={2}
                placeholder={t("notesPlaceholder")}
                value={form.notes}
                onValueChange={(value) => set("notes", value)}
              />
            </div>

            <TextField className="w-full" value={form.url} onChange={(value) => set("url", value)}>
              <Label>{t("sourceUrl")}</Label>
              <Input placeholder={t("sourceUrlPlaceholder")} />
            </TextField>

            <div>
              <MeasurementSystemSelector
                detected={editor.detectedSystem ?? undefined}
                value={form.systemUsed}
                onChange={editor.changeSystem}
              />
              <p className="text-muted mt-2 text-xs">
                {t("measurementSystemNote")}
                {mode === "edit" && t("measurementSystemEditNote")}
              </p>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button
            className="min-w-24"
            isDisabled={isSubmitting}
            size="lg"
            variant="tertiary"
            onPress={handleCancel}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            className="min-w-24"
            isDisabled={isSubmitting}
            isPending={isSubmitting}
            size="lg"
            variant="primary"
            onPress={handleSubmit}
          >
            {mode === "create" ? t("createRecipe") : t("saveChanges")}
          </Button>
        </div>
      </form>
    </div>
  );
}
