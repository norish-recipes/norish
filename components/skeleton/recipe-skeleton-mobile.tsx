"use client";

import { Skeleton } from "@heroui/react";

export default function RecipeSkeletonMobile() {
  return (
    <div className="flex w-full flex-col">
      {/* Hero Image */}
      <Skeleton className="h-72 w-full rounded-none" />

      {/* Unified Content Card */}
      <div className="bg-content1 relative z-10 -mt-6 overflow-visible rounded-t-3xl shadow-sm">
        <div className="space-y-6 px-4 py-5">
          {/* Back link and Actions */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>

          {/* Title */}
          <Skeleton className="h-8 w-3/4 rounded-lg" />

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>

          {/* Time info */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>

          {/* Divider */}
          <div className="bg-default-200 h-px w-full" />

          {/* Ingredients Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full rounded-md" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Divider */}
          <div className="bg-default-200 h-px w-full" />

          {/* Steps Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-6 w-6 flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            {/* Rating Section */}
            <div className="bg-default-100 -mx-1 flex flex-col items-center gap-4 rounded-xl py-6">
              <Skeleton className="h-5 w-48 rounded-md" />
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-5" />
    </div>
  );
}
