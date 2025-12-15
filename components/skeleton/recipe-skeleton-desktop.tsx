"use client";

import { Skeleton } from "@heroui/react";

export default function RecipeSkeletonDesktop() {
  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <Skeleton className="h-4 w-32 rounded-md" />

      {/* Main content grid: 5 columns */}
      <div className="grid grid-cols-5 gap-6">
        {/* LEFT column: Info Card + Ingredients Card */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Info Card */}
          <div className="bg-content1 space-y-4 rounded-2xl p-6 shadow-md">
            {/* Title and Actions */}
            <div className="flex items-start justify-between">
              <Skeleton className="h-8 w-3/4 rounded-lg" />
              <Skeleton className="ml-4 h-10 w-10 flex-shrink-0 rounded-lg" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>

            {/* Time info */}
            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>

          {/* Ingredients Card */}
          <div className="bg-content1 space-y-4 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full rounded-md" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        {/* RIGHT column: Image + Steps Card */}
        <div className="col-span-3 flex flex-col gap-6">
          {/* Hero Image */}
          <Skeleton className="min-h-[400px] w-full rounded-2xl" />

          {/* Steps Card */}
          <div className="bg-content1 rounded-2xl shadow-md">
            <div className="flex items-center justify-between px-6 pt-6">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="space-y-4 px-3 pt-4 pb-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            {/* Rating Section */}
            <div className="bg-default-100 mx-3 mt-4 mb-3 flex flex-col items-center gap-4 rounded-xl py-6">
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
    </div>
  );
}
