"use client";

import React, { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import Image from "next/image";

import { useRecipeContext } from "../context";

import ImageLightbox from "@/components/shared/image-lightbox";

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
      <ol className="mt-2 list-none space-y-4 text-sm leading-relaxed">
        {recipe?.steps
          .filter((s) => s.systemUsed === recipe.systemUsed)
          .sort((a, b) => a.order - b.order)
          .map((s, i) => {
            const isDone = done.has(i);
            const stepImages = s.images || [];

            return (
              <li key={i}>
                <div
                  aria-pressed={isDone}
                  className="grid cursor-pointer grid-cols-[1.5rem_1fr] items-start gap-3 select-none focus:outline-none"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(i)}
                  onKeyDown={(e) => onKeyToggle(e, i)}
                >
                  {isDone ? (
                    <CheckCircleIcon className="text-success h-5 w-5" />
                  ) : (
                    <span className="text-default-600 w-6 text-center text-sm font-medium">
                      {i + 1}.
                    </span>
                  )}
                  <div className="flex flex-col gap-2">
                    <p
                      className={
                        (isDone ? "text-default-400 line-through " : "text-foreground ") +
                        "m-0 rounded-none border-0 bg-transparent text-sm"
                      }
                    >
                      {s.step}
                    </p>

                    {/* Step images */}
                    {stepImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stepImages.map((img, imgIndex) => (
                          <button
                            key={imgIndex}
                            className="group relative h-20 w-20 overflow-hidden rounded-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
                            type="button"
                            onClick={(e) =>
                              openLightbox(
                                stepImages.map((si) => ({
                                  src: si.image,
                                  alt: `Step ${i + 1} image ${imgIndex + 1}`,
                                })),
                                imgIndex,
                                e
                              )
                            }
                          >
                            <Image
                              fill
                              unoptimized
                              alt={`Step ${i + 1} image ${imgIndex + 1}`}
                              className="object-cover"
                              src={img.image}
                            />
                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
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
