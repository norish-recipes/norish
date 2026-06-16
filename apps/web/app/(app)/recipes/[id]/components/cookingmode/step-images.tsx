"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { FallbackPlaceholder, useImageErrors } from "@/components/shared/fallback-image";
import ImageLightbox from "@/components/shared/image-lightbox";
import { Carousel } from "@heroui-pro/react";
import { Button } from "@heroui/react";

import type { ResolvedCookingModeStep } from "./cooking-mode-steps";

type StepImagesProps = {
  className?: string;
  step: ResolvedCookingModeStep;
};

export function StepImages({ className = "", step }: StepImagesProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const { handleImageError, hasError } = useImageErrors();
  const lightboxImages = useMemo(
    () =>
      step.images.map((image, index) => ({
        src: image.image,
        alt: `Step ${step.stepNumber} image ${index + 1}`,
      })),
    [step.images, step.stepNumber]
  );

  const primaryImage = step.images[0];

  if (!primaryImage) {
    return null;
  }

  return (
    <div className={className}>
      {step.images.length === 1 ? (
        <div className="bg-surface-secondary relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl">
          {hasError(primaryImage.image) ? (
            <FallbackPlaceholder className="h-full w-full rounded-xl" />
          ) : (
            <Image
              fill
              unoptimized
              priority
              alt={`Step ${step.stepNumber} image 1`}
              className="object-cover"
              sizes="(min-width: 768px) 520px, 92vw"
              src={primaryImage.image}
              onError={() => handleImageError(primaryImage.image)}
            />
          )}
          <Button
            fullWidth
            aria-label={`Open step ${step.stepNumber} image 1`}
            className="absolute inset-0 h-full min-h-0 rounded-xl bg-transparent p-0 hover:bg-black/10"
            variant="tertiary"
            onPress={() => {
              setLightboxInitialIndex(0);
              setLightboxOpen(true);
            }}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-md">
          <Carousel className="[--carousel-gap:0px]" opts={{ loop: true }}>
            <Carousel.Content>
              {step.images.map((image, index) => (
                <Carousel.Item key={`${image.image}-${index}`}>
                  <div className="bg-surface-secondary relative aspect-video overflow-hidden rounded-xl">
                    {hasError(image.image) ? (
                      <FallbackPlaceholder className="h-full w-full rounded-xl" />
                    ) : (
                      <Image
                        fill
                        unoptimized
                        alt={`Step ${step.stepNumber} image ${index + 1}`}
                        className="object-cover"
                        sizes="(min-width: 768px) 384px, 92vw"
                        src={image.image}
                        onError={() => handleImageError(image.image)}
                      />
                    )}
                    <Button
                      fullWidth
                      aria-label={`Open step ${step.stepNumber} image ${index + 1}`}
                      className="absolute inset-0 h-full min-h-0 rounded-xl bg-transparent p-0 hover:bg-black/10"
                      variant="tertiary"
                      onPress={() => {
                        setLightboxInitialIndex(index);
                        setLightboxOpen(true);
                      }}
                    />
                  </div>
                </Carousel.Item>
              ))}
            </Carousel.Content>
            <Carousel.Previous className="bg-background/70 !left-2 backdrop-blur-md" />
            <Carousel.Next className="bg-background/70 !right-2 backdrop-blur-md" />
            <Carousel.Dots className="mt-3" />
          </Carousel>
        </div>
      )}

      <ImageLightbox
        backdropClassName="z-[1300]"
        containerClassName="z-[1301]"
        images={lightboxImages}
        initialIndex={lightboxInitialIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
