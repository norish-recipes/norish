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
              <Skeleton className="rounded-medium h-5 w-32" />
              <Skeleton className="rounded-medium ml-auto h-5 w-5" />
              <Skeleton className="rounded-medium h-8 w-8 shrink-0" />
            </div>

            <div className="divide-default-100 bg-content1 flex flex-col gap-2 divide-y px-2 py-2">
              {Array.from({ length: storeIndex === 0 ? 4 : 3 }).map((_, itemIndex) => (
                <div
                  key={itemIndex}
                  className="bg-content1 flex min-h-14 items-center gap-3 rounded-lg px-4 py-3"
                >
                  <Skeleton className="rounded-medium h-4 max-w-xs flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
