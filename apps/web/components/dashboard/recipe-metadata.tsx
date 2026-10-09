"use client";

import HeartButton from "@/components/shared/heart-button";
import { EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import { Button } from "@heroui/react";

interface RecipeMetadataProps {
  onOptionsPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}
export default function RecipeMetadata({
  onOptionsPress,
  isFavorite = false,
  onToggleFavorite,
}: RecipeMetadataProps) {
  return (
    <>
      {/* Heart button - top left (only shown when favorited) */}
      {onToggleFavorite && (
        <div className="pointer-events-auto absolute top-2 left-2 z-20">
          <HeartButton
            hideWhenNotFavorite
            showBackground
            isFavorite={isFavorite}
            size="md"
            onToggle={onToggleFavorite}
          />
        </div>
      )}

      {/* Right side: the options button, from tablet width up */}
      <div className="pointer-events-auto absolute top-2 right-2 z-20 flex items-center gap-2">
        {onOptionsPress && (
          <Button
            isIconOnly
            className="bg-surface text-foreground hidden h-6 w-6 min-w-0 p-0 shadow-md md:flex"
            size="sm"
            onPress={onOptionsPress}
            variant="tertiary"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </>
  );
}
