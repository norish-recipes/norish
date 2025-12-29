"use client";

import { Skeleton } from "@heroui/react";

export default function GrocerySkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <div className="flex flex-col gap-3 p-1">
        {Array.from({ length: 3 }).map((_, storeIndex) => (
          <div key={storeIndex} className="overflow-hidden rounded-xl">
            <div className="bg-default-100 flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-5 w-32 rounded-medium" />
              <Skeleton className="ml-auto h-5 w-5 rounded-medium" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-medium" />
            </div>

           <div className="divide-default-100 divide-y bg-content1 px-2 py-2 flex flex-col gap-2">
              {Array.from({ length: storeIndex === 0 ? 4 : 3 }).map(
                (_, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-3 px-4 py-3 min-h-14 rounded-lg bg-content1">
                    <Skeleton className="h-4 flex-1 max-w-xs rounded-medium" />
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
