"use client";

import { SmartInstruction } from "@/components/recipe/smart-instruction";
import { BookOpenIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { Button, Chip, Meter, ScrollShadow, Surface, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { IngredientLinkCandidate } from "@norish/shared-react/text";

import type { ResolvedCookingModeStep } from "./cooking-mode-steps";
import { StepImages } from "./step-images";
import { clampStep } from "./utils";

type CookingStepViewProps = {
  activeStep: number;
  recipeId: string;
  recipeName: string;
  steps: ResolvedCookingModeStep[];
  ingredientCandidates: IngredientLinkCandidate[];
  onIngredientPress?: (candidate: IngredientLinkCandidate) => void;
  onStepChange: (step: number) => void;
};

export function CookingStepView({
  activeStep,
  recipeId,
  recipeName,
  steps,
  ingredientCandidates,
  onIngredientPress,
  onStepChange,
}: CookingStepViewProps) {
  const tCookMode = useTranslations("recipes.cookMode");
  const tCommon = useTranslations("common.actions");
  const step = steps[activeStep];
  const totalSteps = steps.length;
  const progressValue = totalSteps > 0 ? ((activeStep + 1) / totalSteps) * 100 : 0;
  const previousDisabled = activeStep <= 0;
  const nextDisabled = activeStep >= totalSteps - 1;

  if (!step) {
    return (
      <Surface
        className="text-muted flex min-h-64 items-center justify-center p-6"
        variant="secondary"
      >
        {tCookMode("steps")}
      </Surface>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Scrollable content area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollShadow className="h-full px-5 py-5 md:px-8 md:py-6" size={64}>
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="bg-accent text-accent-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-semibold tabular-nums md:h-12 md:w-12 md:text-2xl">
                {step.stepNumber}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {step.heading ? (
                  <Chip color="accent" variant="soft">
                    <BookOpenIcon className="size-4 translate-y-px" />
                    <Chip.Label>{step.heading}</Chip.Label>
                  </Chip>
                ) : null}
              </div>
            </div>

            <div className="text-foreground min-w-0 text-2xl leading-relaxed font-medium md:text-3xl md:leading-relaxed">
              <SmartInstruction
                recipeId={recipeId}
                recipeName={recipeName}
                stepIndex={step.originalIndex}
                text={step.text}
                ingredientCandidates={ingredientCandidates}
                onIngredientPress={onIngredientPress}
              />
            </div>

            <StepImages step={step} />
          </div>
        </ScrollShadow>
      </div>

      {/* Fixed bottom navigation */}
      <div className="border-border shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-4">
        <Meter
          aria-label={tCookMode("stepCounter", {
            current: activeStep + 1,
            total: totalSteps,
          })}
          className="mb-3 w-full"
          color="accent"
          value={progressValue}
        >
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
        </Meter>

        <div className="flex items-center justify-between gap-3">
          <Tooltip delay={0}>
            <Button
              isIconOnly
              aria-label={tCommon("back")}
              isDisabled={previousDisabled}
              variant="secondary"
              onPress={() => onStepChange(clampStep(activeStep - 1, totalSteps))}
            >
              <ChevronUpIcon className="size-5" />
            </Button>
            <Tooltip.Content placement="top">{tCommon("back")}</Tooltip.Content>
          </Tooltip>

          <div className="text-muted text-sm font-medium tabular-nums">
            {tCookMode("stepCounter", {
              current: activeStep + 1,
              total: totalSteps,
            })}
          </div>

          <Tooltip delay={0}>
            <Button
              isIconOnly
              aria-label={nextDisabled ? tCommon("done") : tCommon("next")}
              isDisabled={nextDisabled}
              variant="primary"
              onPress={() => onStepChange(clampStep(activeStep + 1, totalSteps))}
            >
              <ChevronDownIcon className="size-5" />
            </Button>
            <Tooltip.Content placement="top">
              {nextDisabled ? tCommon("done") : tCommon("next")}
            </Tooltip.Content>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
