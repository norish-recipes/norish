"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import { FallbackPlaceholder, useImageErrors } from "@/components/shared/fallback-image";
import ImageLightbox from "@/components/shared/image-lightbox";
import VideoPlayer from "@/components/shared/video-player";
import { Carousel, useCarousel } from "@/components/ui/carousel";
import { useTranslations } from "next-intl";

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
  images?: Array<{
    id?: string;
    image: string;
    order?: number;
  }>;
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
    items.push({
      type: "image" as const,
      src: recipe.image,
      order: 999,
    });
  }
  return items;
}
export interface MediaCarouselProps {
  items: MediaItem[];
  onImageClick?: (index: number) => void;
  onActiveItemChange?: (item: MediaItem, index: number) => void;
  onActiveVideoControlsVisibilityChange?: (visible: boolean) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "4/3";
  rounded?: boolean;
}

type MediaCarouselSlidesProps = {
  handleImageError: (src: string) => void;
  hasError: (src: string) => boolean;
  mediaBoxClassName: string;
  onActiveItemChange?: (item: MediaItem, index: number) => void;
  onActiveVideoControlsVisibilityChange?: (visible: boolean) => void;
  onImageClick: (item: MediaItem, itemIndex: number) => void;
  sortedItems: MediaItem[];
};

function MediaCarouselSlides({
  handleImageError,
  hasError,
  mediaBoxClassName,
  onActiveItemChange,
  onActiveVideoControlsVisibilityChange,
  onImageClick,
  sortedItems,
}: MediaCarouselSlidesProps) {
  const { selectedIndex } = useCarousel();
  const safeIndex = Math.min(selectedIndex, sortedItems.length - 1);

  useEffect(() => {
    const activeItem = sortedItems[safeIndex];
    if (!activeItem) return;

    onActiveItemChange?.(activeItem, safeIndex);

    if (activeItem.type !== "video") {
      onActiveVideoControlsVisibilityChange?.(false);
    }
  }, [onActiveItemChange, onActiveVideoControlsVisibilityChange, safeIndex, sortedItems]);

  return (
    <Carousel.Content className="h-full">
      {sortedItems.map((item, index) => (
        <Carousel.Item key={`${item.id ?? item.src}-${index}`} className="h-full">
          <div className={mediaBoxClassName}>
            {item.type === "video" ? (
              <VideoPlayer
                className="h-full w-full"
                duration={item.duration}
                poster={item.thumbnail || undefined}
                src={item.src}
                onControlsVisibilityChange={
                  index === safeIndex ? onActiveVideoControlsVisibilityChange : undefined
                }
              />
            ) : hasError(item.src) ? (
              <FallbackPlaceholder />
            ) : (
              <div
                className="group relative h-full w-full cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onImageClick(item, index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onImageClick(item, index);
                  }
                }}
              >
                <NextImage
                  fill
                  unoptimized
                  alt={`Recipe media ${index + 1}`}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 100vw"
                  src={item.src}
                  onError={() => handleImageError(item.src)}
                />
              </div>
            )}
          </div>
        </Carousel.Item>
      ))}
    </Carousel.Content>
  );
}

export default function MediaCarousel({
  items,
  onImageClick,
  onActiveItemChange,
  onActiveVideoControlsVisibilityChange,
  className = "",
  aspectRatio = "video",
  rounded = true,
}: MediaCarouselProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { handleImageError, hasError } = useImageErrors();

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

  useEffect(() => {
    if (sortedItems.length !== 1) return;

    const activeItem = sortedItems[0];
    onActiveItemChange?.(activeItem, 0);

    if (activeItem.type !== "video") {
      onActiveVideoControlsVisibilityChange?.(false);
    }
  }, [onActiveItemChange, onActiveVideoControlsVisibilityChange, sortedItems]);

  const openLightboxForItem = useCallback(
    (item: MediaItem, itemIndex: number) => {
      if (item.type !== "image") return;

      const imgIndex = lightboxImages.findIndex((img) => img.src === item.src);
      if (imgIndex !== -1) {
        setLightboxIndex(imgIndex);
        setLightboxOpen(true);
      }
      onImageClick?.(itemIndex);
    },
    [lightboxImages, onImageClick]
  );

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    "4/3": "aspect-[4/3]",
  }[aspectRatio];
  const roundedClass = rounded ? "rounded-2xl" : "";
  const mediaBoxClassName = `bg-surface-tertiary relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className}`;
  const carouselClassName = [
    "relative w-full [--carousel-gap:0px]",
    "[&_[data-slot=carousel-viewport-wrapper]]:h-full [&_[data-slot=carousel-viewport]]:h-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Case 0: No items
  if (!sortedItems || sortedItems.length === 0) {
    return (
      <div
        className={`bg-surface-tertiary relative w-full overflow-hidden ${roundedClass} ${aspectRatioClass} ${className} flex items-center justify-center`}
      >
        <span className="text-muted font-medium">{t("noMediaAvailable")}</span>
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
              onControlsVisibilityChange={onActiveVideoControlsVisibilityChange}
            />
          ) : hasError(item.src) ? (
            <FallbackPlaceholder />
          ) : (
            <div
              className="group relative h-full w-full cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => openLightboxForItem(item, 0)}
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
                sizes="(min-width: 1024px) 60vw, (min-width: 768px) 50vw, 100vw"
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
      <Carousel className={carouselClassName} opts={{ loop: true }}>
        <MediaCarouselSlides
          handleImageError={handleImageError}
          hasError={hasError}
          mediaBoxClassName={mediaBoxClassName}
          sortedItems={sortedItems}
          onActiveItemChange={onActiveItemChange}
          onActiveVideoControlsVisibilityChange={onActiveVideoControlsVisibilityChange}
          onImageClick={openLightboxForItem}
        />
        <Carousel.Previous className="bg-background/70 text-foreground backdrop-blur-md" />
        <Carousel.Next className="bg-background/70 text-foreground backdrop-blur-md" />
        <Carousel.Dots className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/20 px-2 py-1 backdrop-blur-sm" />
      </Carousel>

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
