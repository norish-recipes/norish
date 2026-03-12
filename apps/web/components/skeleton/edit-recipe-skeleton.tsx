"use client";

import { Skeleton } from "@heroui/react";

export default function EditRecipeSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="mb-2 h-10 w-48 rounded-lg" />
            <Skeleton className="h-5 w-64 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      <div className="space-y-10">
        {/* Photo Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-32 rounded-lg" />
          <div className="ml-9">
            <Skeleton className="aspect-video max-h-80 w-full rounded-xl" />
          </div>
        </section>

        {/* Basic Info Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-48 rounded-lg" />
          <div className="ml-9 space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </section>

        {/* Ingredients Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-40 rounded-lg" />
          <div className="ml-9 space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </section>

        {/* Instructions Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-40 rounded-lg" />
          <div className="ml-9 space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </section>

        {/* Tags Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-24 rounded-lg" />
          <div className="ml-9">
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </section>

        {/* Additional Info Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-56 rounded-lg" />
          <div className="ml-9 space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </section>

        {/* Details Section */}
        <section>
          <Skeleton className="mb-4 h-7 w-32 rounded-lg" />
          <div className="ml-9 space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </section>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 border-t pt-6">
          <Skeleton className="h-12 w-24 rounded-lg" />
          <Skeleton className="h-12 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
