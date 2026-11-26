import type { UnitsMap } from "@norish/config/zod/server-config";
import type {
  FullRecipeDTO,
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  MeasurementSystem,
  RecipeCategory,
} from "@norish/shared/contracts";
import type { UnitStyle } from "@norish/shared/contracts/zod/device-preferences";
import { inferSystemUsedFromParsed } from "@norish/shared/lib/determine-recipe-system";
import { isDirtyState } from "@norish/shared/lib/dirty-state";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { formatUnit } from "@norish/shared/lib/unit-localization";

/** An ingredient line as the editor holds it; `unit` is the label the reader sees. */
export interface ParsedIngredient {
  id?: string;
  version?: number;
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  order: number;
  systemUsed: MeasurementSystem;
}

export interface StepImage {
  id?: string;
  image: string;
  order: number;
  version?: number;
}

/** An `@` reference: which ingredient line a step uses, and how much of it. */
export interface StepIngredientRef {
  ingredientOrder: number;
  share: number;
  order?: number;
}

export interface Step {
  step: string;
  order: number;
  systemUsed: MeasurementSystem;
  version?: number;
  images?: StepImage[];
  stepIngredients?: StepIngredientRef[];
}

export interface RecipeGalleryMedia {
  id?: string;
  type: "image" | "video";
  src: string;
  thumbnail?: string | null;
  duration?: number | null;
  order: number;
  version?: number;
}

/** Recipe Provenance as the form holds it: one atomic group. */
export interface ProvenanceFormValue {
  originCountry: string | null;
  /** The country's written name as the editor saw it, or, untouched, the stored one. */
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

export interface RecipeFormState {
  name: string;
  description: string;
  notes: string;
  url: string;
  /** Null while the field is empty, so a count can be cleared and retyped. */
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  tags: string[];
  categories: RecipeCategory[];
  ingredients: ParsedIngredient[];
  steps: Step[];
  systemUsed: MeasurementSystem;
  media: RecipeGalleryMedia[];
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
  provenance: ProvenanceFormValue;
}

export type RecipeEditorMode = "create" | "edit";

/** The fields a form refuses to save without, each with its `recipes.validation` key. */
export type RecipeFormErrors = Partial<
  Record<
    "name" | "ingredients" | "steps" | "servings",
    "nameRequired" | "ingredientsRequired" | "stepsRequired" | "servingsMin"
  >
>;

/** How a line's stored unit reads in the reader's language and unit style. */
export type UnitLabeller = { locale: string; units: UnitsMap; unitStyle: UnitStyle };

/** A recipe's images and videos as the media editor holds them, in one order. */
export function buildInitialMedia(initialData?: FullRecipeDTO): RecipeGalleryMedia[] {
  const media: RecipeGalleryMedia[] = [];

  initialData?.images?.forEach((img) => {
    media.push({
      id: img.id,
      type: "image",
      src: img.image,
      order: img.order,
      version: img.version,
    });
  });
  initialData?.videos?.forEach((vid) => {
    media.push({
      id: vid.id,
      type: "video",
      src: vid.video,
      thumbnail: vid.thumbnail,
      duration: vid.duration,
      order: vid.order,
      version: vid.version,
    });
  });

  return media.sort((a, b) => a.order - b.order);
}

/** The recipe's lines in its active system, as the editor's rows start. */
export function editorIngredientsOf(
  recipe: FullRecipeDTO,
  { locale, units, unitStyle }: UnitLabeller
): ParsedIngredient[] {
  return recipe.recipeIngredients
    .filter((ing) => ing.systemUsed === recipe.systemUsed)
    .map((ing) => ({
      id: ing.id,
      version: ing.version,
      ingredientName: ing.ingredientName,
      amount: ing.amount,
      unit: ing.unit ? formatUnit(ing.unit, locale, units, ing.amount, unitStyle) : null,
      order: ing.order,
      systemUsed: ing.systemUsed,
    }));
}

/** The recipe's steps in its active system, as the editor's rows start. */
export function editorStepsOf(recipe: FullRecipeDTO): Step[] {
  return recipe.steps
    .filter((step) => step.systemUsed === recipe.systemUsed)
    .map((step) => ({
      step: step.step,
      order: step.order,
      systemUsed: step.systemUsed,
      version: step.version,
      images: step.images || [],
      stepIngredients: step.stepIngredients || [],
    }));
}

/** The form a recipe opens with; lines and steps are left empty, the editor seeds them. */
export function initialRecipeForm(initialData?: FullRecipeDTO): RecipeFormState {
  return {
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    notes: initialData?.notes ?? "",
    url: initialData?.url ?? "",
    servings: initialData?.servings ?? 1,
    prepMinutes: initialData?.prepMinutes ?? null,
    cookMinutes: initialData?.cookMinutes ?? null,
    totalMinutes: initialData?.totalMinutes ?? null,
    tags: initialData?.tags?.map((tag) => tag.name) ?? [],
    categories: initialData?.categories ?? [],
    ingredients: [],
    steps: [],
    systemUsed: initialData?.systemUsed ?? "metric",
    media: buildInitialMedia(initialData),
    calories: initialData?.calories ?? null,
    fat: initialData?.fat != null ? Number(initialData.fat) : null,
    carbs: initialData?.carbs != null ? Number(initialData.carbs) : null,
    protein: initialData?.protein != null ? Number(initialData.protein) : null,
    provenance: initialData
      ? {
          originCountry: initialData.originCountry ?? null,
          originCountryName: initialData.originCountryName ?? null,
          originRegion: initialData.originRegion ?? "",
          provenanceNote: initialData.provenanceNote ?? "",
          cuisineIds: initialData.cuisines.map((cuisine) => cuisine.id),
        }
      : { ...EMPTY_PROVENANCE_FORM_VALUE },
  };
}

/** Whether the form differs from what it opened with, lines and steps included. */
export function isRecipeFormDirty(
  current: RecipeFormState,
  mode: RecipeEditorMode,
  initialData: FullRecipeDTO | undefined,
  labeller: UnitLabeller
): boolean {
  const editing = mode === "edit" && initialData ? initialData : undefined;
  const initial: RecipeFormState = {
    ...initialRecipeForm(initialData),
    ingredients: editing ? editorIngredientsOf(editing, labeller) : [],
    steps: editing ? editorStepsOf(editing) : [],
  };

  return isDirtyState(current, initial);
}

export function validateRecipeForm(form: RecipeFormState): RecipeFormErrors {
  const errors: RecipeFormErrors = {};

  if (!form.name.trim()) errors.name = "nameRequired";
  if (form.ingredients.length === 0) errors.ingredients = "ingredientsRequired";
  if (form.steps.length === 0) errors.steps = "stepsRequired";
  if (form.servings === null || form.servings < 1) errors.servings = "servingsMin";

  return errors;
}

// A list's entries, not their order: the same ones removed and added back are no change.
const changed = (now: readonly string[], was: readonly string[] | undefined) =>
  !was || now.length !== was.length || now.some((value) => !was.includes(value));

/** Whether the reader changed a field from the recipe as opened; nothing opened is all changed. */
const mine = <T>(value: T, was: T | undefined) =>
  was === undefined ||
  (Array.isArray(value) && value.every((item) => typeof item === "string")
    ? changed(value, was as string[])
    : isDirtyState(value, was));

const placeOf = ({ cuisineIds: _, ...place }: ProvenanceFormValue) => place;

/** A draft kept after a stale answer, on the fresh recipe: each field the reader changed from
 * `opened` keeps their value, every other takes the fresh one. `opened` rebases to the fresh form. */
export function rebaseRecipeForm(
  form: RecipeFormState,
  opened: RecipeFormState,
  fresh: FullRecipeDTO,
  labeller: UnitLabeller
): RecipeFormState {
  const now: RecipeFormState = {
    ...initialRecipeForm(fresh),
    ingredients: editorIngredientsOf(fresh, labeller),
    steps: editorStepsOf(fresh),
  };
  // Steps point at lines by position, so lines and steps move as one: all the reader's or all fresh.
  const lines = mine(form.ingredients, opened.ingredients) || mine(form.steps, opened.steps);
  const rebased = { ...now };

  for (const key of Object.keys(now) as (keyof RecipeFormState)[]) {
    const kept = key === "ingredients" || key === "steps" ? lines : mine(form[key], opened[key]);

    if (kept) Object.assign(rebased, { [key]: form[key] });
  }
  const { cuisineIds } = form.provenance;

  return {
    ...rebased,
    provenance: {
      ...(mine(placeOf(form.provenance), placeOf(opened.provenance))
        ? placeOf(form.provenance)
        : placeOf(now.provenance)),
      cuisineIds: mine(cuisineIds, opened.provenance.cuisineIds)
        ? cuisineIds
        : now.provenance.cuisineIds,
    },
  };
}

/** A save's payload (servings valid). An edit passes the form it `opened` with: a list left as it
 * was is not sent, so a change made to it elsewhere meanwhile stays. */
export function recipeFormPayload(
  form: RecipeFormState & { servings: number },
  opened?: RecipeFormState
) {
  // Lines are renumbered below; each reference follows its line, one to a line not saved goes.
  const renumbered = new Map(form.ingredients.map((ing, idx) => [ing.order, idx]));
  const refsOf = (refs: StepIngredientRef[]) =>
    refs.flatMap((ref) => {
      const to = renumbered.get(ref.ingredientOrder);

      return to === undefined ? [] : [{ ...ref, ingredientOrder: to }];
    });

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    notes: form.notes.trim() || null,
    url: form.url.trim() || null,
    servings: form.servings,
    prepMinutes: form.prepMinutes,
    cookMinutes: form.cookMinutes,
    totalMinutes: form.totalMinutes,
    calories: form.calories,
    fat: form.fat != null ? form.fat.toString() : null,
    carbs: form.carbs != null ? form.carbs.toString() : null,
    protein: form.protein != null ? form.protein.toString() : null,
    originCountry: form.provenance.originCountry,
    originCountryName: form.provenance.originCountryName,
    originRegion: form.provenance.originRegion.trim() || null,
    provenanceNote: form.provenance.provenanceNote.trim() || null,
    ...(changed(form.provenance.cuisineIds, opened?.provenance.cuisineIds) && {
      cuisines: form.provenance.cuisineIds,
    }),
    systemUsed: form.systemUsed,
    ...(changed(form.tags, opened?.tags) && { tags: form.tags.map((name) => ({ name })) }),
    ...(changed(form.categories, opened?.categories) && { categories: form.categories }),
    recipeIngredients: form.ingredients.map((ing, idx) => ({
      id: ing.id,
      version: ing.version,
      ingredientName: ing.ingredientName,
      ingredientId: null,
      amount: ing.amount,
      unit: ing.unit,
      order: idx,
      systemUsed: ing.systemUsed,
    })),
    steps: form.steps.map((step, idx) => ({
      step: step.step,
      order: idx,
      systemUsed: step.systemUsed,
      version: step.version,
      images: step.images || [],
      stepIngredients: refsOf(step.stepIngredients ?? []),
    })),
    images: form.media
      .filter((item) => item.type === "image")
      .map((img) => ({ id: img.id, image: img.src, order: img.order, version: img.version })),
    videos: form.media
      .filter((item) => item.type === "video")
      .map((vid) => ({
        id: vid.id,
        video: vid.src,
        thumbnail: vid.thumbnail ?? null,
        duration: vid.duration ?? null,
        order: vid.order,
        version: vid.version,
      })),
  } satisfies Omit<FullRecipeInsertDTO, "id"> & Omit<FullRecipeUpdateDTO, "version">;
}

/** The system a new recipe's lines read as, or null when none parse. */
export function detectFormSystem(
  ingredients: ParsedIngredient[],
  units: UnitsMap
): MeasurementSystem | null {
  const lines = ingredients.map((ing) =>
    `${ing.amount ?? ""} ${ing.unit ?? ""} ${ing.ingredientName}`.trim()
  );
  const parsed = parseIngredientWithDefaults(lines, units);

  return parsed.length > 0 ? inferSystemUsedFromParsed(parsed) : null;
}
