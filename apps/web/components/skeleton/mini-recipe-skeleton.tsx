"use client";

import { Skeleton } from "@heroui/react";

export default function MiniRecipeSkeleton() {
  return (
    <div aria-busy className="divide-default-200 flex flex-col divide-y">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="focus-visible:ring-primary flex gap-3 rounded-md py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <div className="bg-default-200 relative h-20 w-20 shrink-0 overflow-hidden rounded-md">
            <Skeleton className="absolute inset-0 h-full w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
