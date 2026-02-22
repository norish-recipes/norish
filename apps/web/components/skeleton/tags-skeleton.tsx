"use client";

import { cssGlassBackdropChip } from "@norish/web/config/css-tokens";

interface TagsSkeletonProps {
  /**
   * Whether to use glass styling (for overlays on images)
   * @default false
   */
  glass?: boolean;
}

/**
 * Skeleton for recipe tags loading state.
 * Shows 3 pill-shaped skeletons with varied widths for visual interest.
 *
 * When glass=true, uses the same glass backdrop styling as real chips
 * with a subtle pulse animation instead of the default skeleton shimmer.
 */
export default function TagsSkeleton({ glass = false }: TagsSkeletonProps) {
  if (glass) {
    // For glass mode, use divs with the same styling as real chips + pulse animation
    // This avoids the HeroUI Skeleton's shimmer effect that conflicts with backdrop-blur
    return (
      <div className="flex flex-wrap gap-1">
        <div className={`h-6 w-16 animate-pulse rounded-full ${cssGlassBackdropChip}`} />
        <div className={`h-6 w-20 animate-pulse rounded-full ${cssGlassBackdropChip}`} />
        <div className={`h-6 w-14 animate-pulse rounded-full ${cssGlassBackdropChip}`} />
      </div>
    );
  }

  // For non-glass mode, use simple skeleton styling
  return (
    <div className="flex flex-wrap gap-1">
      <div className="bg-default-200 h-6 w-16 animate-pulse rounded-full" />
      <div className="bg-default-200 h-6 w-20 animate-pulse rounded-full" />
      <div className="bg-default-200 h-6 w-14 animate-pulse rounded-full" />
    </div>
  );
}
