"use client";

import React, { useState } from "react";
import Image from "next/image";
import { SmartInstruction } from "@/components/recipe/smart-instruction";
import ImageLightbox from "@/components/shared/image-lightbox";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { CheckIcon } from "@heroicons/react/16/solid";

import { useRecipeContext } from "../context";

type StepLike = {
  step: string;
  systemUsed: string;
  order: number;
  images?: Array<{ image: string }>;
};

type SmartInstructionLike = React.ComponentType<{
  text: string;
  recipeId: string;
  token?: string;
  recipeName?: string;
  stepIndex: number;
}>;

type ReadonlyStepsListProps = {
  steps: StepLike[];
  systemUsed: string;
  interactive?: boolean;
  enableTimers?: boolean;
  recipeId?: string;
  token?: string;
  recipeName?: string;
  /** Override the timer-aware instruction renderer (e.g. for public share pages). */
  InstructionComponent?: SmartInstructionLike;
};

export function ReadonlyStepsList({
  steps,
  systemUsed,
  interactive = false,
  enableTimers = false,
  recipeId,
  token,
  recipeName,
  InstructionComponent = SmartInstruction,
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

  const onKeyToggle = (e: React.KeyboardEvent, i: number) => {
    if (!interactive) {
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(i);
    }
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

  let stepNumber = 0;

  return (
    <>
      <ol className="space-y-3">
        {filteredSteps.map((s, i) => {
          const isHeading = s.step.trim().startsWith("#");
          const isDone = done.has(i);
          const stepImages = s.images || [];

          if (isHeading) {
            const headingText = s.step.trim().replace(/^#+\s*/, "");

            return (
              <li key={i} className="list-none">
                <div className="px-3 py-2">
                  <h3 className="text-foreground text-base font-semibold">{headingText}</h3>
                </div>
              </li>
            );
          }

          stepNumber += 1;
          const currentStepNumber = stepNumber;

          return (
            <li key={i}>
              <div
                aria-pressed={interactive ? isDone : undefined}
                className={`flex gap-4 rounded-xl p-3 transition-all duration-200 select-none ${
                  interactive
                    ? "group hover:bg-default-100 dark:hover:bg-default-100/10 cursor-pointer"
                    : "bg-transparent"
                }`}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={() => toggle(i)}
                onKeyDown={(e) => onKeyToggle(e, i)}
              >
                <div className="bg-primary text-primary-foreground relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  <span
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                      interactive && isDone ? "scale-0 opacity-0" : "scale-100 opacity-100"
                    }`}
                  >
                    {currentStepNumber}
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
                      interactive && isDone ? "text-default-400 line-through" : "text-foreground"
                    }`}
                  >
                    {interactive && !isDone && enableTimers ? (
                      <InstructionComponent
                        recipeId={recipeId || ""}
                        recipeName={recipeName}
                        stepIndex={currentStepNumber - 1}
                        text={s.step}
                        token={token}
                      />
                    ) : (
                      <SmartMarkdownRenderer disableLinks={interactive && isDone} text={s.step} />
                    )}
                  </div>

                  {stepImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {stepImages.map((img, imgIndex) => (
                        <button
                          key={imgIndex}
                          className={`group/img ring-default-200 focus:ring-primary dark:ring-default-700 relative h-16 w-16 overflow-hidden rounded-lg shadow-sm ring-1 transition-all duration-200 focus:ring-2 focus:outline-none md:h-20 md:w-20 ${
                            interactive && isDone
                              ? "opacity-50 grayscale"
                              : "hover:ring-primary-300 dark:hover:ring-primary-600 hover:scale-105 hover:shadow-md"
                          }`}
                          type="button"
                          onClick={(e) =>
                            openLightbox(
                              stepImages.map((si, imageIndex) => ({
                                src: si.image,
                                alt: `Step ${currentStepNumber} image ${imageIndex + 1}`,
                              })),
                              imgIndex,
                              e
                            )
                          }
                        >
                          <Image
                            fill
                            unoptimized
                            alt={`Step ${currentStepNumber} image ${imgIndex + 1}`}
                            className="object-cover"
                            src={img.image}
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

export default function StepsList() {
  const { recipe } = useRecipeContext();

  return (
    <ReadonlyStepsList
      enableTimers
      interactive
      recipeId={recipe?.id}
      recipeName={recipe?.name}
      steps={recipe?.steps ?? []}
      systemUsed={recipe?.systemUsed ?? "metric"}
    />
  );
}
