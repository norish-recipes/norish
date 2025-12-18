"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Input, Button, Kbd } from "@heroui/react";
import { useRouter } from "next/navigation";
import { PhotoIcon } from "@heroicons/react/16/solid";

import { FullRecipeDTO, MeasurementSystem } from "@/types";
import { createClientLogger } from "@/lib/logger";
import TagInput from "@/components/shared/tag-input";
import SmartTextInput from "@/components/shared/smart-text-input";
import SmartInputHelp from "@/components/shared/smart-input-help";
import IngredientInput, { ParsedIngredient } from "@/components/recipes/ingredient-input";
import StepInput, { Step } from "@/components/recipes/step-input";
import TimeInputs from "@/components/recipes/time-inputs";
import MeasurementSystemSelector from "@/components/recipes/measurement-system-selector";
import { useRecipesContext } from "@/context/recipes-context";
import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { useUnitsQuery } from "@/hooks/config";
import { useRecipeImages, useRecipeId } from "@/hooks/recipes";
import { useClipboardImagePaste } from "@/hooks/use-clipboard-image-paste";

const log = createClientLogger("RecipeForm");

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Use hooks for recipe images and ID reservation
  const { uploadImage, deleteImage, isUploadingImage } = useRecipeImages();
  const {
    recipeId,
    isLoading: isLoadingRecipeId,
    error: recipeIdError,
  } = useRecipeId(mode, initialData?.id);

  // Form state
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [image, setImage] = useState(initialData?.image ?? "");
  const [servings, setServings] = useState(initialData?.servings ?? 1);
  const [prepMinutes, setPrepMinutes] = useState<number | null>(initialData?.prepMinutes ?? null);
  const [cookMinutes, setCookMinutes] = useState<number | null>(initialData?.cookMinutes ?? null);
  const [totalMinutes, setTotalMinutes] = useState<number | null>(
    initialData?.totalMinutes ?? null
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags?.map((t) => t.name) ?? []);
  const [ingredients, setIngredients] = useState<ParsedIngredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [systemUsed, setSystemUsed] = useState<MeasurementSystem>(
    initialData?.systemUsed ?? "metric"
  );
  const [detectedSystem, setDetectedSystem] = useState<MeasurementSystem | null>(null);
  const [manuallySetSystem, setManuallySetSystem] = useState(false);

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
  useEffect(() => {
    if (initialData && mode === "edit") {
      const initIngredients: ParsedIngredient[] = initialData.recipeIngredients.map((ing) => ({
        ingredientName: ing.ingredientName,
        amount: ing.amount,
        unit: ing.unit,
        order: ing.order,
        systemUsed: ing.systemUsed,
      }));

      setIngredients(initIngredients);

      const initSteps: Step[] = initialData.steps.map((s) => ({
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

  const handleImageUpload = useCallback(
    async (file: File) => {
      setErrors((prev) => ({ ...prev, image: "" }));

      try {
        const result = await uploadImage(file);

        if (!result.success) {
          throw new Error(result.error || "Failed to upload image");
        }

        setImage(result.url!);
      } catch (err) {
        setErrors((prev) => ({ ...prev, image: (err as Error).message }));
      }
    },
    [uploadImage]
  );

  const onImageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];

      if (file) handleImageUpload(file);
    },
    [handleImageUpload]
  );

  const onImageDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];

      if (file) handleImageUpload(file);
    },
    [handleImageUpload]
  );

  const { getOnPasteHandler } = useClipboardImagePaste({
    onFiles: (pastedFiles) => {
      const file = pastedFiles[0];
      if (file) handleImageUpload(file);
    },
  });
  const onImagePaste = getOnPasteHandler();

  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Recipe name is required";
    }

    if (ingredients.length === 0) {
      newErrors.ingredients = "At least one ingredient is required";
    }

    if (steps.length === 0) {
      newErrors.steps = "At least one step is required";
    }

    if (servings < 1) {
      newErrors.servings = "Servings must be at least 1";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }, [name, ingredients, steps, servings]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const recipeData = {
        name: name.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        image: image || null,
        servings,
        prepMinutes: prepMinutes ?? undefined,
        cookMinutes: cookMinutes ?? undefined,
        totalMinutes: totalMinutes ?? undefined,
        calories: calories ?? undefined,
        fat: fat != null ? fat.toString() : undefined,
        carbs: carbs != null ? carbs.toString() : undefined,
        protein: protein != null ? protein.toString() : undefined,
        systemUsed,
        tags: tags.map((t) => ({ name: t })),
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
      };

      if (mode === "create") {
        try {
          await createRecipe({ ...recipeData, id: recipeId! });
        } catch (err) {
          // Clean up uploaded image on failure
          if (image && !initialData?.image) {
            try {
              await deleteImage(image);
            } catch (cleanupErr) {
              log.error({ err: cleanupErr }, "Failed to clean up image");
            }
          }
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
    image,
    servings,
    prepMinutes,
    cookMinutes,
    totalMinutes,
    systemUsed,
    tags,
    ingredients,
    steps,
    mode,
    initialData,
    createRecipe,
    updateRecipe,
    deleteImage,
    recipeId,
    calories,
    fat,
    carbs,
    protein,
  ]);

  const handleTimeChange = useCallback(
    (field: "prepMinutes" | "cookMinutes" | "totalMinutes", value: number | null) => {
      if (field === "prepMinutes") setPrepMinutes(value);
      else if (field === "cookMinutes") setCookMinutes(value);
      else if (field === "totalMinutes") setTotalMinutes(value);
    },
    []
  );

  // Show loading state while reserving recipe ID for create mode
  if (isLoadingRecipeId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-default-500">Initializing form...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {mode === "create" ? "Create Recipe" : "Edit Recipe"}
            </h1>
            <p className="text-default-500 mt-2">
              {mode === "create"
                ? "Add a new recipe to your collection"
                : "Update your recipe details"}
            </p>
          </div>
        </div>

        {errors.submit && (
          <div className="bg-danger-50 dark:bg-danger-100/10 border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 mt-4 rounded-lg border p-4">
            {errors.submit}
          </div>
        )}
      </div>

      <form className="space-y-10">
        {/* 1. Photo */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              1
            </span>
            Photo
          </h2>
          <div className="ml-0 md:ml-9">
            {image ? (
              <div className="border-default-200 relative aspect-video max-h-80 w-full overflow-hidden rounded-xl border-2">
                <img alt="Recipe" className="h-full w-full object-cover" src={image} />
                <Button
                  className="absolute top-3 right-3"
                  color="danger"
                  size="sm"
                  variant="shadow"
                  onPress={() => setImage("")}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <button
                className={[
                  "flex w-full cursor-pointer justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all",
                  dragActive
                    ? "border-primary bg-primary-50 dark:bg-primary-950/20 scale-[1.02]"
                    : "border-default-300 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/10",
                  isUploadingImage ? "pointer-events-none opacity-50" : "",
                ].join(" ")}
                type="button"
                onClick={() => imageInputRef.current?.click()}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onImageDrop}
                onPaste={onImagePaste}
              >
                <div className="text-center">
                  <PhotoIcon className="text-default-400 mx-auto h-16 w-16" />
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <span className="text-primary text-base font-semibold">
                      {isUploadingImage ? "Uploading..." : "Click to upload or drag and drop"}
                    </span>
                    {!isUploadingImage && (
                      <p className="text-default-500 flex items-center gap-1.5 text-xs">
                        <Kbd keys={["ctrl"]}>V</Kbd> to paste
                      </p>
                    )}
                    <p className="text-default-400 text-xs">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                  <input
                    ref={imageInputRef}
                    accept="image/*"
                    className="sr-only"
                    disabled={isUploadingImage}
                    type="file"
                    onChange={onImageInputChange}
                  />
                </div>
              </button>
            )}
            {errors.image && <p className="text-danger-600 mt-2 text-sm">{errors.image}</p>}
          </div>
        </section>

        {/* 2. Basic Information */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              2
            </span>
            Basic Information
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
              label="Recipe Name"
              placeholder="e.g., Chocolate Chip Cookies"
              size="lg"
              value={name}
              onValueChange={setName}
            />

            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="text-foreground text-sm font-medium">Description</span>
                <SmartInputHelp />
              </div>
              <SmartTextInput
                minRows={2}
                placeholder="A brief description of what makes this recipe special..."
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
            Ingredients
            <span className="text-danger-500 text-lg">*</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <p className="text-default-500 mb-3 flex items-center gap-1 text-sm">
              Type ingredients like &quot;2 cups flour&quot; - we&apos;ll automatically parse
              amounts and units.
              <SmartInputHelp />
            </p>
            <IngredientInput
              ingredients={ingredients}
              systemUsed={systemUsed}
              onChange={setIngredients}
            />
            {errors.ingredients && (
              <p className="text-danger-600 mt-2 text-sm">{errors.ingredients}</p>
            )}
          </div>
        </section>

        {/* 4. Instructions */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              4
            </span>
            Instructions
            <span className="text-danger-500 text-lg">*</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <p className="text-default-500 mb-3 flex items-center gap-1 text-sm">
              Write clear step-by-step instructions. Press Enter to move to the next step.
              <SmartInputHelp />
            </p>
            <StepInput
              recipeId={recipeId ?? undefined}
              steps={steps}
              systemUsed={systemUsed}
              onChange={setSteps}
            />
            {errors.steps && <p className="text-danger-600 mt-2 text-sm">{errors.steps}</p>}
          </div>
        </section>

        {/* 5. Tags */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              5
            </span>
            Tags
          </h2>
          <div className="ml-0 md:ml-9">
            <p className="text-default-500 mb-3 text-sm">
              Type tags and click suggestions to add. Selected tags are blue, new tags have a dashed
              border.
            </p>
            <TagInput value={tags} onChange={setTags} />
          </div>
        </section>

        {/* 6. Nutrition */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">
              6
            </span>
            Nutrition
            <span className="text-default-400 text-sm font-normal">(per serving, optional)</span>
          </h2>
          <div className="ml-0 md:ml-9">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Input
                classNames={{ label: "font-medium text-base" }}
                label="Calories"
                placeholder="—"
                type="number"
                min={0}
                value={calories != null ? calories.toString() : ""}
                onValueChange={(v) => setCalories(v ? parseInt(v, 10) || null : null)}
              />
              <Input
                classNames={{ label: "font-medium text-base" }}
                label="Fat (g)"
                placeholder="—"
                type="number"
                min={0}
                step={0.1}
                value={fat != null ? fat.toString() : ""}
                onValueChange={(v) => setFat(v ? parseFloat(v) || null : null)}
              />
              <Input
                classNames={{ label: "font-medium text-base" }}
                label="Carbs (g)"
                placeholder="—"
                type="number"
                min={0}
                step={0.1}
                value={carbs != null ? carbs.toString() : ""}
                onValueChange={(v) => setCarbs(v ? parseFloat(v) || null : null)}
              />
              <Input
                classNames={{ label: "font-medium text-base" }}
                label="Protein (g)"
                placeholder="—"
                type="number"
                min={0}
                step={0.1}
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
            Details
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                classNames={{
                  label: "font-medium text-base",
                }}
                errorMessage={errors.servings}
                isInvalid={!!errors.servings}
                label="Servings"
                min={1}
                placeholder="1"
                type="number"
                value={servings.toString()}
                onValueChange={(v) => setServings(parseInt(v, 10) || 1)}
              />
            </div>
            <div>
              <span
                className="text-default-700 mb-3 block text-sm font-medium"
                id="cooking-times-label"
              >
                Cooking Times <span className="text-default-400 font-normal">(optional)</span>
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
            Additional Information
          </h2>
          <div className="ml-0 space-y-4 md:ml-9">
            <Input
              classNames={{
                label: "font-medium text-base",
              }}
              label="Source URL"
              placeholder="https://example.com/recipe"
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
                We auto-detect the measurement system from your ingredients, but you can override it
                here.
                {mode === "edit" &&
                  " Note: This updates the system label but does not convert units. Use the Convert action after saving."}
              </p>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button isDisabled={isSubmitting} size="lg" variant="flat" onPress={() => router.back()}>
            Cancel
          </Button>
          <Button
            color="primary"
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
            size="lg"
            onPress={handleSubmit}
          >
            {mode === "create" ? "Create Recipe" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
