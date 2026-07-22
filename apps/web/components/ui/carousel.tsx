"use client";

import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from "embla-carousel";
import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";
import { Button, ScrollShadow } from "@heroui/react";
import useEmblaCarousel from "embla-carousel-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";

type CarouselContextValue = {
  api: EmblaCarouselType | undefined;
  canScrollNext: boolean;
  canScrollPrev: boolean;
  emblaRef: ReturnType<typeof useEmblaCarousel>[0];
  scrollNext: () => void;
  scrollPrev: () => void;
  scrollSnapCount: number;
  scrollTo: (index: number) => void;
  selectedIndex: number;
  setViewportWrapper: (node: HTMLDivElement | null) => void;
  viewportWrapper: HTMLDivElement | null;
};

const CarouselContext = createContext<CarouselContextValue | null>(null);

export function useCarousel() {
  const context = useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel>");
  }

  return context;
}

export interface CarouselRootProps extends ComponentPropsWithoutRef<"div"> {
  opts?: EmblaOptionsType;
  plugins?: EmblaPluginType[];
  setApi?: (api: EmblaCarouselType) => void;
}

function CarouselRoot({ children, className, opts, plugins, setApi, ...props }: CarouselRootProps) {
  const [emblaRef, api] = useEmblaCarousel(opts, plugins);
  const [viewportWrapper, setViewportWrapper] = useState<HTMLDivElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnapCount, setScrollSnapCount] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) return;

    const sync = () => {
      setSelectedIndex(api.selectedScrollSnap());
      setScrollSnapCount(api.scrollSnapList().length);
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    sync();
    api.on("select", sync);
    api.on("reInit", sync);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  useEffect(() => {
    if (api && setApi) setApi(api);
  }, [api, setApi]);

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);
  const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
      }
    },
    [scrollNext, scrollPrev]
  );

  return (
    <CarouselContext.Provider
      value={{
        api,
        canScrollNext,
        canScrollPrev,
        emblaRef,
        scrollNext,
        scrollPrev,
        scrollSnapCount,
        scrollTo,
        selectedIndex,
        setViewportWrapper,
        viewportWrapper,
      }}
    >
      <div
        aria-roledescription="carousel"
        className={twMerge("outline-none", className)}
        data-slot="carousel"
        role="region"
        onKeyDownCapture={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  const { emblaRef, setViewportWrapper } = useCarousel();

  return (
    <div className="relative" data-slot="carousel-viewport-wrapper" ref={setViewportWrapper}>
      <div className="h-full overflow-hidden" data-slot="carousel-viewport" ref={emblaRef}>
        <div
          className={twMerge("ml-[calc(var(--carousel-gap,1rem)*-1)] flex flex-row", className)}
          data-slot="carousel-content"
          {...props}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function CarouselItem({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-roledescription="slide"
      className={twMerge(
        "relative min-w-0 shrink-0 grow-0 basis-full pl-[var(--carousel-gap,1rem)]",
        className
      )}
      data-slot="carousel-item"
      role="group"
      {...props}
    >
      {children}
    </div>
  );
}

interface CarouselNavProps extends Omit<ComponentPropsWithoutRef<typeof Button>, "children"> {
  children?: ReactNode;
  icon?: ReactNode;
}

function CarouselPrevious({ children, className, icon, ...props }: CarouselNavProps) {
  const { canScrollPrev, scrollPrev, viewportWrapper } = useCarousel();

  if (!viewportWrapper) return null;

  return createPortal(
    <Button
      isIconOnly
      aria-label="Previous slide"
      className={twMerge("absolute top-1/2 left-5 z-10 -translate-y-1/2", className)}
      data-slot="carousel-previous"
      isDisabled={!canScrollPrev}
      size="sm"
      variant="tertiary"
      onPress={scrollPrev}
      {...props}
    >
      {children ?? icon ?? <ChevronLeftIcon />}
    </Button>,
    viewportWrapper
  );
}

function CarouselNext({ children, className, icon, ...props }: CarouselNavProps) {
  const { canScrollNext, scrollNext, viewportWrapper } = useCarousel();

  if (!viewportWrapper) return null;

  return createPortal(
    <Button
      isIconOnly
      aria-label="Next slide"
      className={twMerge("absolute top-1/2 right-5 z-10 -translate-y-1/2", className)}
      data-slot="carousel-next"
      isDisabled={!canScrollNext}
      size="sm"
      variant="tertiary"
      onPress={scrollNext}
      {...props}
    >
      {children ?? icon ?? <ChevronRightIcon />}
    </Button>,
    viewportWrapper
  );
}

function CarouselDots({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  const { scrollSnapCount, scrollTo, selectedIndex } = useCarousel();

  if (scrollSnapCount < 2) return null;

  return (
    <div
      className={twMerge("mt-4 flex items-center justify-center gap-2", className)}
      data-slot="carousel-dots"
      {...props}
    >
      {Array.from({ length: scrollSnapCount }, (_, index) => (
        <button
          key={index}
          aria-current={index === selectedIndex || undefined}
          aria-label={`Go to slide ${index + 1}`}
          className="size-2 rounded-full bg-(--default) transition-colors outline-none hover:bg-(--default-hover) focus-visible:ring-2 focus-visible:ring-(--focus) data-[selected=true]:bg-(--accent)"
          data-selected={index === selectedIndex}
          data-slot="carousel-dot"
          type="button"
          onClick={() => scrollTo(index)}
        />
      ))}
    </div>
  );
}

interface CarouselThumbnailsProps extends ComponentPropsWithoutRef<"div"> {
  hideScrollBar?: boolean;
  scrollShadowSize?: number;
}

function CarouselThumbnails({
  children,
  className,
  hideScrollBar,
  scrollShadowSize,
  ...props
}: CarouselThumbnailsProps) {
  return (
    <ScrollShadow
      className={twMerge("-mx-1 mt-4 flex items-center gap-3 p-1", className)}
      data-slot="carousel-thumbnails"
      hideScrollBar={hideScrollBar}
      orientation="horizontal"
      size={scrollShadowSize}
      {...props}
    >
      {children}
    </ScrollShadow>
  );
}

interface CarouselThumbnailProps extends ComponentPropsWithoutRef<"button"> {
  alt?: string;
  index: number;
  src?: string;
}

function CarouselThumbnail({
  alt,
  children,
  className,
  index,
  src,
  ...props
}: CarouselThumbnailProps) {
  const { scrollTo, selectedIndex } = useCarousel();
  const isSelected = index === selectedIndex;

  return (
    <button
      aria-current={isSelected || undefined}
      aria-label={alt ?? `Go to slide ${index + 1}`}
      className={twMerge(
        "relative size-16 shrink-0 overflow-hidden rounded-lg transition-[box-shadow,opacity,transform] duration-150 outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-(--focus) active:scale-95 data-[selected=true]:ring-2 data-[selected=true]:ring-(--accent)",
        className
      )}
      data-selected={isSelected}
      data-slot="carousel-thumbnail"
      type="button"
      onClick={() => scrollTo(index)}
      {...props}
    >
      {children ??
        (src ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URLs / tiny thumbnails, no optimization needed
          <img
            alt={alt ?? ""}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
            draggable={false}
            src={src}
          />
        ) : null)}
    </button>
  );
}

export const Carousel = Object.assign(CarouselRoot, {
  Content: CarouselContent,
  Dots: CarouselDots,
  Item: CarouselItem,
  Next: CarouselNext,
  Previous: CarouselPrevious,
  Root: CarouselRoot,
  Thumbnail: CarouselThumbnail,
  Thumbnails: CarouselThumbnails,
});
