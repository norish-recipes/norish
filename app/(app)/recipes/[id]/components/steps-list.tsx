"use client";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckIcon } from "@heroicons/react/20/solid";
import Image from "next/image";

import { useRecipeContext } from "../context";

import ImageLightbox from "@/components/shared/image-lightbox";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { SmartInstruction } from "@/components/recipe/smart-instruction";

type StepsListProps = {
  autoScrollOnCheck?: boolean;
};

export default function StepsList({ autoScrollOnCheck = false }: StepsListProps) {
  const { recipe } = useRecipeContext();
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt?: string }[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [pendingScrollIndex, setPendingScrollIndex] = useState<number | null>(null);
  const stepRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());

  const filteredSteps = useMemo(() => {
    return (
      recipe?.steps
        .filter((s) => s.systemUsed === recipe.systemUsed)
        .sort((a, b) => a.order - b.order) ?? []
    );
  }, [recipe?.steps, recipe?.systemUsed]);

  const getNextIncompleteStepIndex = (fromIndex: number, doneSet: Set<number>) => {
    for (let idx = fromIndex + 1; idx < filteredSteps.length; idx++) {
      const step = filteredSteps[idx];

      if (step.step.trim().startsWith("#")) {
        continue;
      }

      if (!doneSet.has(idx)) {
        return idx;
      }
    }

    return null;
  };

  const scrollToStep = (index: number) => {
    const target = stepRefs.current.get(index);

    if (!target) {
      return;
    }

  target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };

  const toggle = (i: number) => {
    const next = new Set(done);
    const isCurrentlyDone = next.has(i);

    if (isCurrentlyDone) {
      next.delete(i);
      setPendingScrollIndex(null);
    } else {
      next.add(i);

      if (autoScrollOnCheck) {
        setPendingScrollIndex(getNextIncompleteStepIndex(i, next));
      }
    }

    setDone(next);
  };

  useLayoutEffect(() => {
    if (!autoScrollOnCheck || pendingScrollIndex === null) {
      return;
    }

    const targetIndex = pendingScrollIndex;

    setPendingScrollIndex(null);
    requestAnimationFrame(() => scrollToStep(targetIndex));
  }, [autoScrollOnCheck, pendingScrollIndex]);

  const onKeyToggle = (e: React.KeyboardEvent, i: number) => {
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
    e.stopPropagation(); // Prevent step toggle
    setLightboxImages(images);
    setLightboxInitialIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <ol className="space-y-3">
        {(() => {
          let stepNumber = 0;

          return filteredSteps.map((s, i) => {
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

            // Increment step number for actual steps
            stepNumber++;
            const currentStepNumber = stepNumber;

            return (
              <li
                key={i}
                ref={(node) => {
                  if (node) {
                    stepRefs.current.set(i, node);
                  } else {
                    stepRefs.current.delete(i);
                  }
                }}
                className="scroll-mt-20"
              >
                <div
                  aria-pressed={isDone}
                  className="group hover:bg-default-100 dark:hover:bg-default-100/10 flex cursor-pointer gap-4 rounded-xl p-3 transition-all duration-200 select-none"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(i)}
                  onKeyDown={(e) => onKeyToggle(e, i)}
                >
                  {/* Step number badge */}
                  <div className="bg-primary text-primary-foreground relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    <span
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                        isDone ? "scale-0 opacity-0" : "scale-100 opacity-100"
                      }`}
                    >
                      {currentStepNumber}
                    </span>
                    <CheckIcon
                      className={`h-4 w-4 transition-all duration-200 ${
                        isDone ? "scale-100 opacity-100" : "scale-0 opacity-0"
                      }`}
                    />
                  </div>

                  {/* Step content */}
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <p
                      className={`text-base leading-relaxed transition-all duration-200 ${
                        isDone ? "text-default-400 line-through" : "text-foreground"
                      }`}
                    >
                      {/* Use SmartInstruction to enable timers */}
                      {isDone ? (
                        <SmartMarkdownRenderer disableLinks={true} text={s.step} />
                      ) : (
                        <SmartInstruction
                          recipeId={recipe?.id || ""}
                          recipeName={recipe?.name}
                          stepIndex={currentStepNumber - 1}
                          text={s.step}
                        />
                      )}
                    </p>

                    {/* Step images */}
                    {stepImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stepImages.map((img, imgIndex) => (
                          <button
                            key={imgIndex}
                            className={`group/img ring-default-200 focus:ring-primary dark:ring-default-700 relative h-16 w-16 overflow-hidden rounded-lg shadow-sm ring-1 transition-all duration-200 focus:ring-2 focus:outline-none md:h-20 md:w-20 ${
                              isDone
                                ? "opacity-50 grayscale"
                                : "hover:ring-primary-300 dark:hover:ring-primary-600 hover:scale-105 hover:shadow-md"
                            }`}
                            type="button"
                            onClick={(e) =>
                              openLightbox(
                                stepImages.map((si) => ({
                                  src: si.image,
                                  alt: `Step ${currentStepNumber} image ${imgIndex + 1}`,
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
          });
        })()}
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
