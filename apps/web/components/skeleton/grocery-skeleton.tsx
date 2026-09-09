"use client";

import { Skeleton } from "@heroui/react";

/** The list's shape before it arrives: a heading line on the ground over a card of rows, three times. */
export default function GrocerySkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="flex flex-col gap-4 p-1">
        {Array.from({ length: 3 }).map((_, storeIndex) => (
          <div key={storeIndex} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5 py-1.5 pr-1 pl-2">
              <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="ml-auto h-5 w-5 rounded-md" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            </div>

            <div className="border-border bg-surface shadow-surface divide-border flex flex-col divide-y overflow-hidden rounded-xl border">
              {Array.from({ length: storeIndex === 0 ? 4 : 3 }).map((_, itemIndex) => (
                <div key={itemIndex} className="flex min-h-12 items-center gap-3 px-4 py-3 pl-10">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                  <Skeleton className="h-4 max-w-xs flex-1 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
