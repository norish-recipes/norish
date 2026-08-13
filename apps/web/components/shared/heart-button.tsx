"use client";

import type { MouseEvent } from "react";
import { useCallback } from "react";
import { HeartIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

type HeartButtonProps = {
  isFavorite: boolean;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  showBackground?: boolean;
  hideWhenNotFavorite?: boolean;
};

const sizeClasses = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export default function HeartButton({
  isFavorite,
  onToggle,
  size = "md",
  className = "",
  showBackground = false,
  hideWhenNotFavorite = false,
}: HeartButtonProps) {
  const stopParentActivation = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const iconSize = sizeClasses[size];

  // Hide completely when not favorited and hideWhenNotFavorite is true
  if (hideWhenNotFavorite && !isFavorite) {
    return null;
  }

  return (
    <Button
      isIconOnly
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      className={`group relative transition-all duration-300 ${showBackground ? "bg-surface hover:bg-surface-secondary rounded-full shadow-md" : ""} ${isFavorite ? "scale-100 opacity-100" : "scale-90 opacity-70 hover:scale-100 hover:opacity-100"} ${className} `}
      size={size === "lg" ? "md" : "sm"}
      type="button"
      variant="ghost"
      onClick={stopParentActivation}
      onPress={onToggle}
    >
      <HeartIcon
        className={` ${iconSize} transition-colors duration-300 ease-out ${isFavorite ? "text-red-500" : "text-muted group-hover:text-red-400"} `}
      />
    </Button>
  );
}
