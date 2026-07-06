"use client";

import type { EmblaCarouselType } from "embla-carousel";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Carousel } from "@/components/ui/carousel";
import { XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Modal, Tooltip } from "@heroui/react";

import { FallbackPlaceholder, useImageErrors } from "./fallback-image";

export interface ImageLightboxProps {
  images: {
    src: string;
    alt?: string;
  }[];
  initialIndex?: number;
  isOpen: boolean;
  backdropClassName?: string;
  containerClassName?: string;
  onClose: () => void;
}

function getSafeIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

const TAP_MOVEMENT_THRESHOLD = 8;

export default function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  backdropClassName,
  containerClassName,
  onClose,
}: ImageLightboxProps) {
  const [api, setApi] = useState<EmblaCarouselType>();
  const [currentIndex, setCurrentIndex] = useState(() => getSafeIndex(initialIndex, images.length));
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const { handleImageError, hasError } = useImageErrors();

  const safeInitialIndex = useMemo(
    () => getSafeIndex(initialIndex, images.length),
    [images.length, initialIndex]
  );
  const currentImage = images[getSafeIndex(currentIndex, images.length)];
  const showNavigation = images.length > 1;

  useEffect(() => {
    if (!isOpen) return;

    setCurrentIndex(safeInitialIndex);
  }, [isOpen, safeInitialIndex]);

  useEffect(() => {
    if (!api || !isOpen || images.length === 0) return;

    api.scrollTo(safeInitialIndex, true);
  }, [api, images.length, isOpen, safeInitialIndex]);

  useEffect(() => {
    if (!api) return;

    const syncSelectedIndex = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    syncSelectedIndex();
    api.on("select", syncSelectedIndex);
    api.on("reInit", syncSelectedIndex);

    return () => {
      api.off("select", syncSelectedIndex);
      api.off("reInit", syncSelectedIndex);
    };
  }, [api]);

  if (!isOpen || images.length === 0 || !currentImage) return null;

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleBackdropPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    if (!start) {
      return;
    }

    const moved =
      Math.abs(event.clientX - start.x) > TAP_MOVEMENT_THRESHOLD ||
      Math.abs(event.clientY - start.y) > TAP_MOVEMENT_THRESHOLD;

    if (moved) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest("[data-lightbox-interactive]")) {
      return;
    }

    onClose();
  };

  return (
    <Modal.Backdrop
      isDismissable
      isOpen={isOpen}
      className={`z-[1200] !bg-black text-white ${backdropClassName ?? ""}`}
      variant="opaque"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container className={`z-[1201] p-0 ${containerClassName ?? ""}`} size="full">
        {/*
          pointer-events-none on the Dialog so taps on the dark empty space fall through
          to the Modal.Backdrop, which triggers onOpenChange(false) → dismiss.
          Only interactive children get pointer-events-auto.
        */}
        <Modal.Dialog
          className="flex h-[100dvh] w-[100dvw] flex-col bg-transparent p-0 shadow-none"
          onPointerDown={handleBackdropPointerDown}
          onPointerUp={handleBackdropPointerUp}
        >
          <header
            className="relative z-30 flex shrink-0 items-center justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-[calc(1rem+env(safe-area-inset-top))] sm:pb-3"
            data-lightbox-interactive
          >
            {showNavigation ? (
              <div className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium tabular-nums backdrop-blur-md">
                {getSafeIndex(currentIndex, images.length) + 1} / {images.length}
              </div>
            ) : (
              <div />
            )}

            <Tooltip delay={0}>
              <Button
                isIconOnly
                aria-label="Close image viewer"
                className="size-10 min-w-10 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                variant="tertiary"
                onPress={onClose}
              >
                <XMarkIcon className="size-5" />
              </Button>
              <Tooltip.Content placement="bottom">Close</Tooltip.Content>
            </Tooltip>
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-visible px-4 py-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {showNavigation ? (
              <Carousel
                className="relative flex h-full w-full max-w-5xl flex-col items-center justify-center overflow-visible"
                opts={{ loop: true, startIndex: safeInitialIndex }}
                setApi={setApi}
              >
                <div className="w-full">
                  <Carousel.Content className="items-center">
                    {images.map((image, index) => (
                      <Carousel.Item
                        key={`${image.src}-${index}`}
                        className="flex items-center justify-center"
                      >
                        {hasError(image.src) ? (
                          <FallbackPlaceholder
                            className="h-64 w-full rounded-2xl bg-white/10 sm:rounded-3xl"
                            data-lightbox-interactive
                          />
                        ) : (
                          <Image
                            unoptimized
                            alt={image.alt || `Image ${index + 1}`}
                            className="max-h-[68dvh] w-auto max-w-full rounded-2xl object-contain select-none sm:rounded-3xl"
                            data-lightbox-interactive
                            draggable={false}
                            height={760}
                            sizes="(min-width: 1280px) 1120px, 92vw"
                            src={image.src}
                            width={1120}
                            onError={() => handleImageError(image.src)}
                          />
                        )}
                      </Carousel.Item>
                    ))}
                  </Carousel.Content>
                </div>
                <Carousel.Previous
                  className="bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                  data-lightbox-interactive
                />
                <Carousel.Next
                  className="bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                  data-lightbox-interactive
                />
                <Carousel.Thumbnails
                  className="mt-3 justify-start overflow-x-auto py-1 sm:justify-center"
                  data-lightbox-interactive
                  scrollShadowSize={24}
                >
                  {images.map((image, index) => (
                    <Carousel.Thumbnail
                      key={`${image.src}-thumbnail-${index}`}
                      alt={image.alt || `Image ${index + 1}`}
                      index={index}
                      src={image.src}
                    />
                  ))}
                </Carousel.Thumbnails>
              </Carousel>
            ) : (
              /* Single image — no carousel needed */
              <div className="flex items-center justify-center">
                {hasError(currentImage.src) ? (
                  <FallbackPlaceholder
                    className="h-64 w-full max-w-5xl rounded-2xl bg-white/10 sm:rounded-3xl"
                    data-lightbox-interactive
                  />
                ) : (
                  <Image
                    unoptimized
                    alt={currentImage.alt || "Image"}
                    className="max-h-[68dvh] w-auto max-w-full rounded-2xl object-contain select-none sm:rounded-3xl"
                    data-lightbox-interactive
                    draggable={false}
                    height={760}
                    sizes="(min-width: 1280px) 1120px, 92vw"
                    src={currentImage.src}
                    width={1120}
                    onError={() => handleImageError(currentImage.src)}
                  />
                )}
              </div>
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
