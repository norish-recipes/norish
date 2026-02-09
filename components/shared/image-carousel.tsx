"use client";

import { useState, useCallback } from "react";
import { Button } from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import { AnimatePresence, motion } from "motion/react";
import NextImage from "next/image";
import { useTranslations } from "next-intl";

import ImageLightbox from "./image-lightbox";
import { FallbackPlaceholder, useImageErrors } from "./fallback-image";

export interface CarouselImage {
  image: string;
  alt?: string;
}

export interface ImageCarouselProps {
  images: CarouselImage[];
  recipeName: string;
  className?: string;
  aspectRatio?: "video" | "square" | "4/3"; // default "video" (16:9)
  showLightbox?: boolean; // default true
  rounded?: boolean; // default true - set false for full-bleed hero
}

export default function ImageCarousel({
  images,
  recipeName,
  className = "",
  aspectRatio = "video",
  showLightbox = true,
  rounded = true,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const { handleImageError, hasError } = useImageErrors();

  const t = useTranslations("recipes.carousel");

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    "4/3": "aspect-[4/3]",
  }[aspectRatio];

  const roundedClass = rounded ? "rounded-2xl" : "";

  const handleNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1 === images.length ? 0 : prev + 1));
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    }
    if (isRightSwipe) {
      handlePrev();
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir !== 0 ? (dir > 0 ? 300 : -300) : 0,
      opacity: dir !== 0 ? 0 : 1,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir !== 0 ? (dir < 0 ? 300 : -300) : 0,
      opacity: 0,
    }),
  };

  // Case 0: No images
  if (!images || images.length === 0) {
    return (
      <div
        className={`bg-default-200 relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className} flex items-center justify-center`}
      >
        <span className="text-default-500 font-medium">{t("noImageAvailable")}</span>
      </div>
    );
  }

  // Case 1: Single image
  if (images.length === 1) {
    return (
      <>
        <div
          className={`relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className} group cursor-pointer`}
          role="button"
          tabIndex={0}
          onClick={() => showLightbox && setLightboxOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              showLightbox && setLightboxOpen(true);
            }
          }}
        >
          {hasError(images[0].image) ? (
            <FallbackPlaceholder />
          ) : (
            <NextImage
              fill
              unoptimized
              alt={images[0].alt || recipeName}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              src={images[0].image}
              onError={() => handleImageError(images[0].image)}
            />
          )}
        </div>
        {showLightbox && (
          <ImageLightbox
            images={images.map((img) => ({
              src: img.image,
              alt: img.alt || recipeName,
            }))}
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    );
  }

  // Case 2+: Carousel
  return (
    <>
      <div
        className={`bg-default-200 relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className} group`}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      >
        <AnimatePresence custom={direction} initial={false} mode="popLayout">
          <motion.div
            key={currentIndex}
            animate="center"
            className="absolute inset-0 cursor-pointer"
            custom={direction}
            exit="exit"
            initial="enter"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            variants={slideVariants}
            onClick={() => showLightbox && setLightboxOpen(true)}
          >
            {hasError(images[currentIndex].image) ? (
              <FallbackPlaceholder />
            ) : (
              <NextImage
                fill
                unoptimized
                alt={images[currentIndex].alt || recipeName}
                className="object-cover"
                src={images[currentIndex].image}
                onError={() => handleImageError(images[currentIndex].image)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <div className="absolute top-1/2 left-2 z-10 -translate-y-1/2 sm:left-4">
          <Button
            isIconOnly
            className="bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
            radius="full"
            size="sm"
            onPress={handlePrev}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Button>
        </div>
        <div className="absolute top-1/2 right-2 z-10 -translate-y-1/2 sm:right-4">
          <Button
            isIconOnly
            className="bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
            radius="full"
            size="sm"
            onPress={handleNext}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Dot Indicators */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              className={`h-2 w-2 rounded-full transition-all ${
                idx === currentIndex ? "w-4 bg-white" : "bg-white/50 hover:bg-white/80"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
            />
          ))}
        </div>
      </div>

      {showLightbox && (
        <ImageLightbox
          images={images.map((img) => ({
            src: img.image,
            alt: img.alt || recipeName,
          }))}
          initialIndex={currentIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
