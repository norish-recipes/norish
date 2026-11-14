import type { StepIngredientRefLike } from "@norish/shared/lib/step-ingredients";

type CookingModeStepImage = {
  image: string;
  order?: number;
};

type CookingModeStepLike = {
  step: string;
  systemUsed: string;
  order: number;
  images?: CookingModeStepImage[];
  stepIngredients?: StepIngredientRefLike[];
};

export type ResolvedCookingModeStep = {
  stepNumber: number;
  text: string;
  heading?: string;
  images: CookingModeStepImage[];
  stepIngredients: StepIngredientRefLike[];
};

export function resolveCookingModeSteps(
  steps: CookingModeStepLike[],
  systemUsed: string
): ResolvedCookingModeStep[] {
  const filteredSteps = steps
    .filter((step) => step.systemUsed === systemUsed)
    .sort((a, b) => a.order - b.order);

  const resolved: ResolvedCookingModeStep[] = [];
  let heading: string | undefined;
  let pendingHeadingImages: CookingModeStepImage[] = [];
  let stepNumber = 0;

  filteredSteps.forEach((step) => {
    const text = step.step.trim();
    const images = [...(step.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (text.startsWith("#")) {
      heading = text.replace(/^#+\s*/, "");
      pendingHeadingImages = images;
      return;
    }

    stepNumber += 1;
    resolved.push({
      stepNumber,
      text: step.step,
      heading,
      images: pendingHeadingImages.length > 0 ? [...pendingHeadingImages, ...images] : images,
      stepIngredients: step.stepIngredients ?? [],
    });
    pendingHeadingImages = [];
  });

  return resolved;
}

/** The step index kept within the steps there are; 0 when there are none. */
export function clampStep(step: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(step, 0), total - 1);
}
