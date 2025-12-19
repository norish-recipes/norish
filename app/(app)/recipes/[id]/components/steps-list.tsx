"use client";

import React, { useState } from "react";
import { CheckIcon } from "@heroicons/react/20/solid";
import Image from "next/image";

import { useRecipeContext } from "../context";

import ImageLightbox from "@/components/shared/image-lightbox";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";

export default function StepsList() {
  const { recipe } = useRecipeContext();
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; alt?: string }[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  const toggle = (i: number) => {
    setDone((prev) => {
      const next = new Set(prev);

      if (next.has(i)) next.delete(i);
      else next.add(i);

      return next;
    });
  };

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
          const filteredSteps =
            recipe?.steps
              .filter((s) => s.systemUsed === recipe.systemUsed)
              .sort((a, b) => a.order - b.order) ?? [];

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
              <li key={i}>
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
                      <SmartMarkdownRenderer disableLinks={isDone} text={s.step} />
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
