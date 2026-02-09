"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Input, Button, Chip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { FullRecipeDTO, MeasurementSystem, RecipeCategory } from "@/types";
import { createClientLogger } from "@/lib/logger";
import TagInput from "@/components/shared/tag-input";
import SmartTextInput from "@/components/shared/smart-text-input";
import SmartInputHelp from "@/components/shared/smart-input-help";
import IngredientInput, { ParsedIngredient } from "@/components/recipes/ingredient-input";
import StepInput, { Step } from "@/components/recipes/step-input";
import TimeInputs from "@/components/recipes/time-inputs";
import MeasurementSystemSelector from "@/components/recipes/measurement-system-selector";
import MediaGalleryInput, {
  type RecipeGalleryMedia,
} from "@/components/recipes/media-gallery-input";
import EditRecipeSkeleton from "@/components/skeleton/edit-recipe-skeleton";
import { useRecipesContext } from "@/context/recipes-context";
import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { useUnitsQuery } from "@/hooks/config";
import { useRecipeId } from "@/hooks/recipes";

const log = createClientLogger("RecipeForm");

const ALL_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export interface RecipeFormProps {
  mode: "create" | "edit";
  initialData?: FullRecipeDTO;
}

export default function RecipeForm({ mode, initialData }: RecipeFormProps) {
  const router = useRouter();
  const { createRecipe, updateRecipe } = useRecipesContext();
  const { units } = useUnitsQuery();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const t = useTranslations("recipes.form");
  const tValidation = useTranslations("recipes.validation");
  const tCommon = useTranslations("common.actions");

  // Use hook for ID reservation
  const {
    recipeId,
    isLoading: isLoadingRecipeId,
    error: recipeIdError,
  } = useRecipeId(mode, initialData?.id);

  // Form state
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [servings, setServings] = useState(initialData?.servings ?? 1);
  const [prepMinutes, setPrepMinutes] = useState<number | null>(initialData?.prepMinutes ?? null);
  const [cookMinutes, setCookMinutes] = useState<number | null>(initialData?.cookMinutes ?? null);
  const [totalMinutes, setTotalMinutes] = useState<number | null>(
    initialData?.totalMinutes ?? null
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags?.map((t) => t.name) ?? []);
  const [categories, setCategories] = useState<RecipeCategory[]>(initialData?.categories ?? []);
  const [ingredients, setIngredients] = useState<ParsedIngredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [systemUsed, setSystemUsed] = useState<MeasurementSystem>(
    initialData?.systemUsed ?? "metric"
  );
  const [detectedSystem, setDetectedSystem] = useState<MeasurementSystem | null>(null);
  const [manuallySetSystem, setManuallySetSystem] = useState(false);

  // Media state - unified array of images and videos
  const [media, setMedia] = useState<RecipeGalleryMedia[]>(() => {
    const items: RecipeGalleryMedia[] = [];

    // Add images from initialData
    if (initialData?.images && initialData.images.length > 0) {
      initialData.images.forEach((img) => {
        items.push({
          id: img.id,
          type: "image",
          src: img.image,
          order: img.order,
        });
      });
    } else if (initialData?.image) {
      // Fallback to legacy single image field
      items.push({ type: "image", src: initialData.image, order: 0 });
    }

    // Add videos from initialData
    if (initialData?.videos && initialData.videos.length > 0) {
      initialData.videos.forEach((vid) => {
        items.push({
          id: vid.id,
          type: "video",
          src: vid.video,
          thumbnail: vid.thumbnail,
          duration: vid.duration,
          order: vid.order,
        });
      });
    }

    // Sort by order to maintain unified ordering
    return items.sort((a, b) => a.order - b.order);
  });

  // Nutrition state
  const [calories, setCalories] = useState<number | null>(initialData?.calories ?? null);
  const [fat, setFat] = useState<number | null>(
    initialData?.fat != null ? Number(initialData.fat) : null
  );
  const [carbs, setCarbs] = useState<number | null>(
    initialData?.carbs != null ? Number(initialData.carbs) : null
  );
  const [protein, setProtein] = useState<number | null>(
    initialData?.protein != null ? Number(initialData.protein) : null
  );

  // Show recipe ID error if reservation failed
  useEffect(() => {
    if (recipeIdError) {
      setErrors((prev) => ({ ...prev, general: recipeIdError }));
    }
  }, [recipeIdError]);

  // Initialize ingredients and steps from initialData
  // Filter by the current systemUsed to only show items for the active measurement system
  useEffect(() => {
    if (initialData && mode === "edit") {
      // Filter ingredients by the recipe's measurement system
      const filteredIngredients = initialData.recipeIngredients.filter(
        (ing) => ing.systemUsed === initialData.systemUsed
      );

      const initIngredients: ParsedIngredient[] = filteredIngredients.map((ing) => ({
        ingredientName: ing.ingredientName,
        amount: ing.amount,
        unit: ing.unit,
        order: ing.order,
        systemUsed: ing.systemUsed,
      }));

      setIngredients(initIngredients);

      // Filter steps by the recipe's measurement system
      const filteredSteps = initialData.steps.filter(
        (s) => s.systemUsed === initialData.systemUsed
      );

      const initSteps: Step[] = filteredSteps.map((s) => ({
        step: s.step,
        order: s.order,
        systemUsed: s.systemUsed,
        images: s.images || [],
      }));

      setSteps(initSteps);
    }
  }, [initialData, mode]);

  // Detect measurement system from ingredients and auto-select
  useEffect(() => {
    if (ingredients.length > 0 && !manuallySetSystem) {
      const parsed = ingredients
        .map((ing) => {
          const result = parseIngredientWithDefaults(
            `${ing.amount ?? ""} ${ing.unit ?? ""} ${ing.ingredientName}`.trim(),
            units
          );

          return result[0];
        })
        .filter(Boolean);

      if (parsed.length > 0) {
        const detected = inferSystemUsedFromParsed(parsed);

        setDetectedSystem(detected);
        setSystemUsed(detected);
      }
    }
  }, [ingredients, manuallySetSystem, units]);

  const toggleCategory = useCallback((category: RecipeCategory) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = tValidation("nameRequired");
    }

    if (ingredients.length === 0) {
      newErrors.ingredients = tValidation("ingredientsRequired");
    }

    if (steps.length === 0) {
      newErrors.steps = tValidation("stepsRequired");
    }

    if (servings < 1) {
      newErrors.servings = tValidation("servingsMin");
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }, [name, ingredients, steps, servings, tValidation]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // Extract images from unified media state, preserving their order
      const images = media
        .filter((m) => m.type === "image")
        .map((img) => ({
          id: img.id,
          image: img.src,
          order: img.order,
        }));

      // Get primary image (first image by order) for legacy image field
      const sortedImages = [...images].sort((a, b) => a.order - b.order);
      const primaryImage = sortedImages[0]?.image || null;

      // Extract videos from unified media state, preserving their order
      const videos = media
        .filter((m) => m.type === "video")
        .map((vid) => ({
          id: vid.id,
          video: vid.src,
          thumbnail: vid.thumbnail ?? null,
          duration: vid.duration ?? null,
          order: vid.order,
        }));

      const recipeData = {
        name: name.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        url: url.trim() || null,
        image: primaryImage, // Legacy field - first image
        servings,
        prepMinutes: prepMinutes ?? undefined,
        cookMinutes: cookMinutes ?? undefined,
        totalMinutes: totalMinutes ?? undefined,
        calories,
        fat: fat != null ? fat.toString() : null,
        carbs: carbs != null ? carbs.toString() : null,
        protein: protein != null ? protein.toString() : null,
        systemUsed,
        tags: tags.map((t) => ({ name: t })),
        categories,
        recipeIngredients: ingredients.map((ing, idx) => ({
          ingredientName: ing.ingredientName,
          ingredientId: null,
          amount: ing.amount,
          unit: ing.unit,
          order: idx,
          systemUsed: ing.systemUsed,
        })),
        steps: steps.map((s, idx) => ({
          step: s.step,
          order: idx,
          systemUsed: s.systemUsed,
          images: s.images || [],
        })),
        // Images array field
        images,
        // Videos array field
        videos,
      };

      if (mode === "create") {
        try {
          await createRecipe({ ...recipeData, id: recipeId! });
        } catch (err) {
          log.error({ err }, "Failed to create recipe");
          throw err;
        }
      } else if (mode === "edit" && initialData) {
        await updateRecipe(initialData.id, recipeData);
      }
    } catch (err) {
      setErrors({ submit: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validate,
    name,
    description,
    url,
    media,
    servings,
    prepMinutes,
    cookMinutes,
    totalMinutes,
    systemUsed,
    tags,
    categories,
    ingredients,
    steps,
    mode,
    initialData,
    createRecipe,
    updateRecipe,
    recipeId,
    calories,
    fat,
    carbs,
    protein,
    notes,
  ]);

  const handleTimeChange = useCallback(
    (field: "prepMinutes" | "cookMinutes" | "totalMinutes", value: number | null) => {
      if (field === "prepMinutes") setPrepMinutes(value);
      else if (field === "cookMinutes") setCookMinutes(value);
      else if (field === "totalMinutes") setTotalMinutes(value);
    },
    []
  );

  // Show skeleton while reserving recipe ID for create mode
  if (isLoadingRecipeId) {
    return <EditRecipeSkeleton />;
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
            <p className="text-default-500 mt-2">
              {mode === "create" ? t("createDescription") : t("editDescription")}
            </p>
          </div>
        </div>

        {errors.submit && (
          <div className="bg-danger-50 dark:bg-danger-100/10 border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 mt-4 rounded-lg border p-4">
            {errors.submit}
          </div>
        )}
      </div>

      <form className="min-w-0 space-y-10">
        {/* 1. Photos */}
        <section className="min-w-0">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              1
            </span>
            {t("photo")}
          </h2>
          <div className="ml-0 min-w-0 md:ml-9">
            {recipeId && (
              <MediaGalleryInput media={media} recipeId={recipeId} onChange={setMedia} />
            )}
            {errors.image && <p className="text-danger-600 mt-2 text-base">{errors.image}</p>}
          </div>
        </section>

        {/* 2. Basic Information */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              2
            </span>
            {t("basicInfo")}
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <Input
              isRequired
              classNames={{
                label: "font-medium text-base",
                input: "text-lg",
              }}
              errorMessage={errors.name}
              isInvalid={!!errors.name}
              label={t("recipeName")}
              placeholder={t("recipeNamePlaceholder")}
              size="lg"
              value={name}
              onValueChange={setName}
            />

            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="text-foreground text-sm font-medium">{t("description")}</span>
                <SmartInputHelp />
              </div>
              <SmartTextInput
                minRows={2}
                placeholder={t("descriptionPlaceholder")}
                value={description}
                onValueChange={setDescription}
              />
            </div>
          </div>
        </section>

        {/* 3. Ingredients */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              3
            </span>
            {t("ingredients")}
            <span className="text-danger-500 text-lg">*</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <p className="text-default-500 mb-3 flex items-center gap-1 text-base">
              {t("ingredientsHelp")}
              <SmartInputHelp />
            </p>
            <IngredientInput
              ingredients={ingredients}
              systemUsed={systemUsed}
              onChange={setIngredients}
            />
            {errors.ingredients && (
              <p className="text-danger-600 mt-2 text-base">{errors.ingredients}</p>
            )}
          </div>
        </section>

        {/* 4. Instructions */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              4
            </span>
            {t("instructions")}
            <span className="text-danger-500 text-lg">*</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <p className="text-default-500 mb-3 flex items-center gap-1 text-base">
              {t("instructionsHelp")}
              <SmartInputHelp />
            </p>
            <StepInput
              recipeId={recipeId ?? undefined}
              steps={steps}
              systemUsed={systemUsed}
              onChange={setSteps}
            />
            {errors.steps && <p className="text-danger-600 mt-2 text-base">{errors.steps}</p>}
          </div>
        </section>

        {/* 5. Tags & Categories */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              5
            </span>
            {t("tagsAndCategories")}
          </h2>
          <div className="ml-0 space-y-6 md:ml-9">
            <div>
              <p className="text-default-500 mb-3 text-base">{t("tagsHelp")}</p>
              <TagInput value={tags} onChange={setTags} />
            </div>
            <div>
              <p className="text-default-500 mb-3 text-base">{t("categoriesHelp")}</p>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map((category) => {
                  const active = categories.includes(category);

                  return (
                    <Chip
                      key={category}
                      className="h-8 cursor-pointer px-3 text-sm"
                      color={active ? "primary" : "default"}
                      radius="full"
                      variant={active ? "solid" : "flat"}
                      onClick={() => toggleCategory(category)}
                    >
                      {t(`category.${category.toLowerCase()}`)}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 6. Nutrition */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              6
            </span>
            {t("nutrition")}
            <span className="text-default-400 text-sm font-normal">{t("nutritionPerServing")}</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Input
                classNames={{ label: "font-medium text-base" }}
                label={t("calories")}
                min={0}
                placeholder="—"
                type="number"
                value={calories != null ? calories.toString() : ""}
                onValueChange={(v) => setCalories(v ? parseInt(v, 10) || null : null)}
              />
              <Input
                classNames={{ label: "font-medium text-base" }}
                label={t("fat")}
                min={0}
                placeholder="—"
                step={0.1}
                type="number"
                value={fat != null ? fat.toString() : ""}
                onValueChange={(v) => setFat(v ? parseFloat(v) || null : null)}
              />
              <Input
                classNames={{ label: "font-medium text-base" }}
                label={t("carbs")}
                min={0}
                placeholder="—"
                step={0.1}
                type="number"
                value={carbs != null ? carbs.toString() : ""}
                onValueChange={(v) => setCarbs(v ? parseFloat(v) || null : null)}
              />
              <Input
                classNames={{ label: "font-medium text-base" }}
                label={t("protein")}
                min={0}
                placeholder="—"
                step={0.1}
                type="number"
                value={protein != null ? protein.toString() : ""}
                onValueChange={(v) => setProtein(v ? parseFloat(v) || null : null)}
              />
            </div>
          </div>
        </section>

        {/* 7. Details */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              7
            </span>
            {t("details")}
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                classNames={{
                  label: "font-medium text-base",
                }}
                errorMessage={errors.servings}
                isInvalid={!!errors.servings}
                label={t("servings")}
                min={1}
                placeholder="1"
                type="number"
                value={servings.toString()}
                onValueChange={(v) => setServings(parseInt(v, 10) || 1)}
              />
            </div>
            <div>
              <span
                className="text-default-700 mb-3 block text-base font-medium"
                id="cooking-times-label"
              >
                {t("cookingTimes")}{" "}
                <span className="text-default-400 font-normal">{t("optional")}</span>
              </span>
              <TimeInputs
                cookMinutes={cookMinutes}
                prepMinutes={prepMinutes}
                totalMinutes={totalMinutes}
                onChange={handleTimeChange}
              />
            </div>
          </div>
        </section>

        {/* 8. Additional Information */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              8
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
                value={notes}
                onValueChange={setNotes}
              />
            </div>

            <Input
              classNames={{
                label: "font-medium text-base",
              }}
              label={t("sourceUrl")}
              placeholder={t("sourceUrlPlaceholder")}
              value={url}
              onValueChange={setUrl}
            />

            <div>
              <MeasurementSystemSelector
                detected={detectedSystem ?? undefined}
                value={systemUsed}
                onChange={(sys) => {
                  setSystemUsed(sys);
                  setManuallySetSystem(true);

                  // Update systemUsed on all ingredients and steps
                  setIngredients((prev) => prev.map((ing) => ({ ...ing, systemUsed: sys })));
                  setSteps((prev) => prev.map((step) => ({ ...step, systemUsed: sys })));
                }}
              />
              <p className="text-default-400 mt-2 text-xs">
                {t("measurementSystemNote")}
                {mode === "edit" && t("measurementSystemEditNote")}
              </p>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button isDisabled={isSubmitting} size="lg" variant="flat" onPress={() => router.back()}>
            {tCommon("cancel")}
          </Button>
          <Button
            color="primary"
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
            size="lg"
            onPress={handleSubmit}
          >
            {mode === "create" ? t("createRecipe") : t("saveChanges")}
          </Button>
        </div>
      </form>
    </div>
  );
}
