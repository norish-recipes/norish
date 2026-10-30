"use client";

import React, { useState } from "react";
import Image from "next/image";
import { SmartInstruction } from "@/components/recipe/smart-instruction";
import { StepIngredientsRow } from "@/components/recipes/step-ingredients-row";
import ImageLightbox from "@/components/shared/image-lightbox";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { CheckIcon } from "@heroicons/react/16/solid";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { StepIngredientRefLike } from "@norish/shared/lib/step-ingredients";
import { addBasePath } from "@norish/shared/lib/base-path";

type StepLike = {
  step: string;
  systemUsed: string;
  order: number;
  images?: Array<{ image: string }>;
  stepIngredients?: StepIngredientRefLike[];
};

type SmartInstructionLike = React.ComponentType<{
  text: string;
  recipeId: string;
  token: string;
  recipeName?: string;
  stepIndex: number;
}>;

type IngredientLike = {
  ingredientName: string;
  amount?: number | string | null;
  unit?: string | null;
  systemUsed: string;
  order: number;
};

export type ReadonlyStepsListProps = {
  steps: StepLike[];
  systemUsed: string;
  interactive?: boolean;
  enableTimers?: boolean;
  recipeId?: string;
  recipeName?: string;
  ingredients?: IngredientLike[];
  /** Public surfaces pass their shared unit config; private ones omit it. */
  units?: UnitsMap;
} & (
  | { InstructionComponent?: undefined; token?: undefined }
  /** A share page overrides the timer-aware instruction renderer, which reads the share by its token. */
  | { InstructionComponent: SmartInstructionLike; token: string }
);

/** A step whose text is a markdown heading titles the steps under it. */
const isHeading = (step: StepLike) => step.step.trim().startsWith("#");

export function ReadonlyStepsList({
  steps,
  systemUsed,
  interactive = false,
  enableTimers = false,
  recipeId,
  recipeName,
  ingredients = [],
  units,
  ...instruction
}: ReadonlyStepsListProps) {
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt?: string }[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  const toggle = (i: number) => {
    if (!interactive) {
      return;
    }

    setDone((prev) => {
      const next = new Set(prev);

      if (next.has(i)) next.delete(i);
      else next.add(i);

      return next;
    });
  };

  const openLightbox = (
    images: { src: string; alt?: string }[],
    index: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setLightboxImages(images);
    setLightboxInitialIndex(index);
    setLightboxOpen(true);
  };

  const filteredSteps = steps
    .filter((s) => s.systemUsed === systemUsed)
    .sort((a, b) => a.order - b.order);

  // Each step's number: headings take none.
  const stepNumbers = filteredSteps.reduce<number[]>(
    (numbers, s) => [...numbers, (numbers.at(-1) ?? 0) + (isHeading(s) ? 0 : 1)],
    []
  );

  return (
    <>
      <ol className="space-y-3">
        {filteredSteps.map((s, i) => {
          if (isHeading(s)) {
            const headingText = s.step.trim().replace(/^#+\s*/, "");

            return (
              <li key={s.order} className="list-none">
                <div className="px-3 py-2">
                  <h3 className="text-foreground text-base font-semibold">{headingText}</h3>
                </div>
              </li>
            );
          }

          return (
            <StepLine
              key={s.order}
              InstructionComponent={instruction.InstructionComponent}
              enableTimers={enableTimers}
              index={i}
              ingredients={ingredients}
              interactive={interactive}
              isDone={done.has(i)}
              recipeId={recipeId}
              recipeName={recipeName}
              step={s}
              stepNumber={stepNumbers[i] ?? 0}
              systemUsed={systemUsed}
              token={instruction.token}
              units={units}
              onOpenLightbox={openLightbox}
              onToggle={toggle}
            />
          );
        })}
      </ol>

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxInitialIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

/**
 * One step of the list. Its own component so that a change to one step, or to
 * the ingredients every step's chips scale with, re-renders what changed and
 * not each step's instruction text.
 */
function StepLine({
  step,
  index,
  stepNumber,
  isDone,
  interactive,
  enableTimers,
  recipeId,
  recipeName,
  ingredients,
  units,
  systemUsed,
  InstructionComponent,
  token,
  onToggle,
  onOpenLightbox,
}: {
  step: StepLike;
  index: number;
  stepNumber: number;
  isDone: boolean;
  interactive: boolean;
  enableTimers: boolean;
  recipeId?: string;
  recipeName?: string;
  ingredients: IngredientLike[];
  units?: UnitsMap;
  systemUsed: string;
  InstructionComponent?: SmartInstructionLike;
  token?: string;
  onToggle: (index: number) => void;
  onOpenLightbox: (
    images: { src: string; alt?: string }[],
    index: number,
    e: React.MouseEvent
  ) => void;
}) {
  const stepImages = step.images || [];

  const onKeyToggle = (e: React.KeyboardEvent) => {
    // A key pressed on a control inside the step (a timer, an image) is that
    // control's to handle, not a toggle of the whole step.
    if (!interactive || e.target !== e.currentTarget) {
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(index);
    }
  };

  return (
    <li>
      <div
        aria-pressed={interactive ? isDone : undefined}
        className={`flex gap-3 rounded-xl p-3 transition-all duration-200 select-none md:gap-4 ${
          interactive ? "group hover:bg-surface-secondary cursor-pointer" : "bg-transparent"
        }`}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={() => onToggle(index)}
        onKeyDown={onKeyToggle}
      >
        <div className="bg-accent text-accent-foreground relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          <span
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              interactive && isDone ? "scale-0 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            {stepNumber}
          </span>
          {interactive ? (
            <CheckIcon
              className={`h-4 w-4 transition-all duration-200 ${
                isDone ? "scale-100 opacity-100" : "scale-0 opacity-0"
              }`}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            className={`text-base leading-relaxed transition-all duration-200 ${
              interactive && isDone ? "text-muted line-through" : "text-foreground"
            }`}
          >
            {interactive && !isDone && enableTimers ? (
              InstructionComponent ? (
                <InstructionComponent
                  recipeId={recipeId || ""}
                  recipeName={recipeName}
                  stepIndex={stepNumber - 1}
                  text={step.step}
                  token={token ?? ""}
                />
              ) : (
                <SmartInstruction
                  recipeId={recipeId || ""}
                  recipeName={recipeName}
                  stepIndex={stepNumber - 1}
                  text={step.step}
                />
              )
            ) : (
              <SmartMarkdownRenderer disableLinks={interactive && isDone} text={step.step} />
            )}
          </div>

          {(step.stepIngredients?.length ?? 0) > 0 && (
            <StepIngredientsRow
              ingredients={ingredients}
              refs={step.stepIngredients ?? []}
              systemUsed={systemUsed}
              units={units}
            />
          )}

          {stepImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stepImages.map((img, imgIndex) => (
                <button
                  // The same picture can sit here twice (uploads are named by content hash), so
                  // only its place tells the two apart; the list keeps its stored order.
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={imgIndex}
                  className={`group/img ring-border focus:ring-accent relative h-16 w-16 overflow-hidden rounded-lg shadow-sm ring-1 transition-all duration-200 focus:ring-2 focus:outline-none md:h-20 md:w-20 ${
                    interactive && isDone
                      ? "opacity-50 grayscale"
                      : "hover:ring-accent hover:scale-105 hover:shadow-md"
                  }`}
                  type="button"
                  onClick={(e) =>
                    onOpenLightbox(
                      stepImages.map((si, imageIndex) => ({
                        src: si.image,
                        alt: `Step ${stepNumber} image ${imageIndex + 1}`,
                      })),
                      imgIndex,
                      e
                    )
                  }
                >
                  <Image
                    fill
                    alt={`Step ${stepNumber} image ${imgIndex + 1}`}
                    className="object-cover"
                    src={addBasePath(img.image)}
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover/img:bg-black/10" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
