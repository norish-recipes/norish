"use client";

import HeartButton from "@/components/shared/heart-button";
import {
  ClockIcon,
  EllipsisHorizontalIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import { Button, Chip } from "@heroui/react";

// Over an arbitrary photo a chip carries its own contrast: an opaque surface
// fill plus a shadow, never a tinted window onto the picture (ADR-0020).
const photoChipClassName = "bg-surface text-foreground rounded-full px-2 text-[11px] shadow-md";

interface RecipeMetadataProps {
  timeLabel?: string | null;
  servings?: number | null;
  onOptionsPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  averageRating?: number | null;
}
export default function RecipeMetadata({
  timeLabel,
  servings,
  onOptionsPress,
  isFavorite = false,
  onToggleFavorite,
  averageRating,
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

      {/* Right side metadata */}
      <div className="pointer-events-auto absolute top-2 right-2 z-20 flex items-center gap-2">
        {typeof averageRating === "number" && averageRating > 0 && (
          <Chip className={photoChipClassName} size="sm" variant="soft">
            <StarIcon className="text-warning h-4 w-4" />
            <Chip.Label>{Math.round(averageRating)}</Chip.Label>
          </Chip>
        )}

        {timeLabel && (
          <Chip className={photoChipClassName} size="sm" variant="soft">
            <ClockIcon className="h-4 w-4" />
            <Chip.Label>{timeLabel}</Chip.Label>
          </Chip>
        )}

        {typeof servings === "number" && servings > 0 && (
          <Chip className={photoChipClassName} size="sm" variant="soft">
            <UserGroupIcon className="h-4 w-4" />
            <Chip.Label>{servings}</Chip.Label>
          </Chip>
        )}

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
