"use client";

export type CookingModeStepImage = {
  image: string;
  order?: number;
};

export type CookingModeStepLike = {
  step: string;
  systemUsed: string;
  order: number;
  images?: CookingModeStepImage[];
};

export type ResolvedCookingModeStep = {
  originalIndex: number;
  stepNumber: number;
  text: string;
  heading?: string;
  images: CookingModeStepImage[];
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

  filteredSteps.forEach((step, originalIndex) => {
    const text = step.step.trim();
    const images = [...(step.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (text.startsWith("#")) {
      heading = text.replace(/^#+\s*/, "");
      pendingHeadingImages = images;
      return;
    }

    stepNumber += 1;
    resolved.push({
      originalIndex,
      stepNumber,
      text: step.step,
      heading,
      images: pendingHeadingImages.length > 0 ? [...pendingHeadingImages, ...images] : images,
    });
    pendingHeadingImages = [];
  });

  return resolved;
}
