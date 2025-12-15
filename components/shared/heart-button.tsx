"use client";

import { HeartIcon } from "@heroicons/react/24/solid";
import { useCallback } from "react";

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
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle();
    },
    [onToggle]
  );

  const iconSize = sizeClasses[size];

  // Hide completely when not favorited and hideWhenNotFavorite is true
  if (hideWhenNotFavorite && !isFavorite) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      className={`
        group relative inline-flex items-center justify-center
        transition-all duration-300
        ${showBackground ? "rounded-full bg-black/30 p-1.5 backdrop-blur-sm" : ""}
        ${isFavorite ? "scale-100 opacity-100" : "scale-90 opacity-70 hover:scale-100 hover:opacity-100"}
        ${className}
      `}
      onClick={handleClick}
    >
      <HeartIcon
        className={`
          ${iconSize}
          drop-shadow-md
          transition-colors duration-300 ease-out
          ${isFavorite ? "text-red-500" : "text-white/80 group-hover:text-red-300"}
        `}
      />
    </button>
  );
}
