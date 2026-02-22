"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import { AnimatePresence, motion } from "motion/react";
import NextImage from "next/image";
import { useTranslations } from "next-intl";

import VideoPlayer from "@/components/shared/video-player";
import ImageLightbox from "@/components/shared/image-lightbox";
import { FallbackPlaceholder, useImageErrors } from "@/components/shared/fallback-image";

export interface MediaItem {
  type: "image" | "video";
  src: string;
  thumbnail?: string | null;
  duration?: number | null;
  order: number;
  id?: string;
}

/** Recipe media data shape for buildMediaItems */
interface RecipeMedia {
  videos?: Array<{
    id?: string;
    video: string;
    thumbnail?: string | null;
    duration?: number | null;
    order: number;
  }>;
  images?: Array<{ id?: string; image: string; order?: number }>;
  image?: string | null;
}

/**
 * Builds MediaItem array from recipe videos/images for use with MediaCarousel.
 * Items are sorted by their order field to maintain user-defined positioning.
 */
export function buildMediaItems(recipe: RecipeMedia): MediaItem[] {
  const items: MediaItem[] = [];

  // Add videos with their order
  if (recipe.videos) {
    for (const vid of recipe.videos) {
      items.push({
        type: "video" as const,
        src: vid.video,
        thumbnail: vid.thumbnail,
        duration: vid.duration,
        order: vid.order,
        id: vid.id,
      });
    }
  }

  // Add images with their order
  if (recipe.images) {
    for (const img of recipe.images) {
      items.push({
        type: "image" as const,
        src: img.image,
        order: img.order ?? 0,
        id: img.id,
      });
    }
  }

  // Fallback to legacy recipe.image if no images array
  if ((!recipe.images || recipe.images.length === 0) && recipe.image) {
    items.push({ type: "image" as const, src: recipe.image, order: 999 });
  }

  return items;
}

export interface MediaCarouselProps {
  items: MediaItem[];
  onImageClick?: (index: number) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "4/3";
  rounded?: boolean;
}

export default function MediaCarousel({
  items,
  onImageClick,
  className = "",
  aspectRatio = "video",
  rounded = true,
}: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { handleImageError, hasError } = useImageErrors();
  const lightboxOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const t = useTranslations("recipes.carousel");

  // Sort items: order ascending, then videos before images
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (a.type !== b.type) return a.type === "video" ? -1 : 1;

      return 0;
    });
  }, [items]);

  // Extract images for lightbox
  const lightboxImages = useMemo(() => {
    return sortedItems
      .filter((item) => item.type === "image")
      .map((item) => ({
        src: item.src,
        alt: `Recipe media ${item.id || ""}`,
      }));
  }, [sortedItems]);

  const clearPendingLightboxOpen = useCallback(() => {
    if (lightboxOpenTimeoutRef.current) {
      clearTimeout(lightboxOpenTimeoutRef.current);
      lightboxOpenTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingLightboxOpen();
    };
  }, [clearPendingLightboxOpen]);

  const handleNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1 === sortedItems.length ? 0 : prev + 1));
  }, [sortedItems.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? sortedItems.length - 1 : prev - 1));
  }, [sortedItems.length]);

  // Swipe handlers
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

  const openLightboxForItem = useCallback(
    (item: MediaItem, itemIndex: number) => {
      const imgIndex = lightboxImages.findIndex((img) => img.src === item.src);

      if (imgIndex !== -1) {
        setLightboxIndex(imgIndex);
        setLightboxOpen(true);
      }
      onImageClick?.(itemIndex);
    },
    [lightboxImages, onImageClick]
  );

  const handleItemClick = (item: MediaItem, itemIndex: number, clickDetail: number) => {
    if (item.type !== "image") {
      return;
    }

    if (clickDetail > 1 || lightboxOpenTimeoutRef.current) {
      clearPendingLightboxOpen();

      return;
    }

    clearPendingLightboxOpen();
    lightboxOpenTimeoutRef.current = setTimeout(() => {
      openLightboxForItem(item, itemIndex);
      lightboxOpenTimeoutRef.current = null;
    }, 250);
  };

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    "4/3": "aspect-[4/3]",
  }[aspectRatio];

  const roundedClass = rounded ? "rounded-2xl" : "";

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir !== 0 ? (dir > 0 ? "100%" : "-100%") : 0,
      opacity: 0, // Fade out while sliding for smoother effect
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir !== 0 ? (dir < 0 ? "100%" : "-100%") : 0,
      opacity: 0,
    }),
  };

  // Case 0: No items
  if (!sortedItems || sortedItems.length === 0) {
    return (
      <div
        className={`bg-default-200 relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className} flex items-center justify-center`}
      >
        <span className="text-default-500 font-medium">{t("noMediaAvailable")}</span>
      </div>
    );
  }

  // Case 1: Single item (no carousel controls)
  if (sortedItems.length === 1) {
    const item = sortedItems[0];

    return (
      <>
        <div
          className={`relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className}`}
        >
          {item.type === "video" ? (
            <VideoPlayer
              className="h-full w-full"
              duration={item.duration}
              poster={item.thumbnail || undefined}
              src={item.src}
            />
          ) : hasError(item.src) ? (
            <FallbackPlaceholder />
          ) : (
            <div
              className="group relative h-full w-full cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={(e) => handleItemClick(item, 0, e.detail)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openLightboxForItem(item, 0);
                }
              }}
            >
              <NextImage
                fill
                unoptimized
                alt="Recipe image"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                src={item.src}
                onError={() => handleImageError(item.src)}
              />
            </div>
          )}
        </div>
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // Case 2+: Carousel
  return (
    <>
      <div
        className={`bg-default-200 relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className} group touch-pan-y`}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      >
        <AnimatePresence custom={direction} initial={false} mode="popLayout">
          <motion.div
            key={currentIndex}
            animate="center"
            className="absolute inset-0 h-full w-full"
            custom={direction}
            exit="exit"
            initial="enter"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            variants={slideVariants}
          >
            {sortedItems[currentIndex].type === "video" ? (
              <VideoPlayer
                className="h-full w-full"
                duration={sortedItems[currentIndex].duration}
                poster={sortedItems[currentIndex].thumbnail || undefined}
                src={sortedItems[currentIndex].src}
              />
            ) : hasError(sortedItems[currentIndex].src) ? (
              <FallbackPlaceholder />
            ) : (
              <div
                className="relative h-full w-full cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={(e) => handleItemClick(sortedItems[currentIndex], currentIndex, e.detail)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightboxForItem(sortedItems[currentIndex], currentIndex);
                  }
                }}
              >
                <NextImage
                  fill
                  unoptimized
                  alt={`Recipe media ${currentIndex + 1}`}
                  className="object-cover"
                  src={sortedItems[currentIndex].src}
                  onError={() => handleImageError(sortedItems[currentIndex].src)}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows (Desktop Only - appear on hover) */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:px-4">
          <Button
            isIconOnly
            className="pointer-events-auto bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
            radius="full"
            size="sm"
            onPress={handlePrev}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Button>
          <Button
            isIconOnly
            className="pointer-events-auto bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
            radius="full"
            size="sm"
            onPress={handleNext}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Dot Indicators */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {sortedItems.map((item, idx) => (
            <button
              key={`${item.id || idx}`}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex ? "w-4 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
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

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
