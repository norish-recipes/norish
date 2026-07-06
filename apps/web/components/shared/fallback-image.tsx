"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import NextImage, { ImageProps as NextImageProps } from "next/image";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

interface FallbackPlaceholderProps extends ComponentProps<"div"> {
  className?: string;
  message?: string;
}

function FallbackPlaceholder({ className = "", message, ...props }: FallbackPlaceholderProps) {
  const t = useTranslations("recipes.carousel");

  return (
    <div
      {...props}
      className={`bg-surface-tertiary flex h-full w-full items-center justify-center ${className}`}
    >
      <PhotoIcon aria-label={message || t("noImageAvailable")} className="text-muted h-12 w-12" />
    </div>
  );
}

// Props for Next.js Image variant
type NextFallbackImageProps = Omit<NextImageProps, "onError"> & {
  variant?: "next";
  fallbackClassName?: string;
  fallbackMessage?: string;
};

// Props for HeroUI Image variant
type HeroFallbackImageProps = Omit<ComponentProps<"img">, "onError"> & {
  variant: "hero";
  fallbackClassName?: string;
  fallbackMessage?: string;
};

export type FallbackImageProps = NextFallbackImageProps | HeroFallbackImageProps;

export default function FallbackImage(props: FallbackImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <FallbackPlaceholder className={props.fallbackClassName} message={props.fallbackMessage} />
    );
  }

  if (props.variant === "hero") {
    const {
      variant: _variant,
      fallbackClassName: _fallbackClassName,
      fallbackMessage: _fallbackMessage,
      alt,
      ...imageProps
    } = props;

    return <img alt={alt ?? ""} {...imageProps} onError={() => setHasError(true)} />;
  }

  const {
    variant: _variant,
    fallbackClassName: _fallbackClassName,
    fallbackMessage: _fallbackMessage,
    ...imageProps
  } = props as NextFallbackImageProps;

  return <NextImage {...imageProps} onError={() => setHasError(true)} />;
}

// For components that track errors across multiple images (carousels)
export function useImageErrors() {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (src: string) => {
    setImageErrors((prev) => new Set(prev).add(src));
  };

  const hasError = (src: string) => imageErrors.has(src);

  return { handleImageError, hasError };
}

export { FallbackPlaceholder };
