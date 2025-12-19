"use client";

import {
  ClockIcon,
  UserGroupIcon,
  EllipsisHorizontalIcon,
  StarIcon,
} from "@heroicons/react/20/solid";
import { Chip, Button } from "@heroui/react";

import HeartButton from "@/components/shared/heart-button";
import { cssGlassBackdropChip } from "@/config/css-tokens";

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
          <Chip
            className={`px-2 text-[11px] text-white ${cssGlassBackdropChip}`}
            radius="full"
            size="sm"
            startContent={<StarIcon className="text-warning h-4 w-4" />}
            variant="flat"
          >
            {averageRating.toFixed(1)}
          </Chip>
        )}

        {timeLabel && (
          <Chip
            className={`px-2 text-[11px] text-white ${cssGlassBackdropChip}`}
            radius="full"
            size="sm"
            startContent={<ClockIcon className="h-4 w-4" />}
            variant="flat"
          >
            {timeLabel}
          </Chip>
        )}

        {typeof servings === "number" && servings > 0 && (
          <Chip
            className={`px-2 text-[11px] text-white ${cssGlassBackdropChip}`}
            radius="full"
            size="sm"
            startContent={<UserGroupIcon className="h-4 w-4" />}
            variant="flat"
          >
            {servings}
          </Chip>
        )}

        <Button
          isIconOnly
          className={`text-white ${cssGlassBackdropChip} h-6 w-6 min-w-0 p-0`}
          radius="full"
          size="sm"
          variant="flat"
          onPress={onOptionsPress}
        >
          <EllipsisHorizontalIcon className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
