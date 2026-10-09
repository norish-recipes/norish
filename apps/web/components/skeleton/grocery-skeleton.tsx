"use client";

import { useDevicePreference } from "@/context/device-preferences-context";
import { Skeleton } from "@heroui/react";

/**
 * The list's shape before it arrives, in the reader's view and grouping: a
 * card with a heading bar over its rows, three times. By store, a heading
 * carries the Store's dot; by recipe it is a recipe's name. Ungrouped, each
 * row names the recipe it came from beneath it.
 */
export default function GrocerySkeleton() {
  const [view] = useDevicePreference("groceryViewMode");
  const [grouped] = useDevicePreference("groceryGroupSimilar");
  const byStore = view === "store";
  const withSourceLine = byStore && !grouped;

  return (
    <div
      className="mx-auto w-full max-w-7xl p-6"
      data-grocery-skeleton={view}
      data-grocery-skeleton-grouping={byStore && grouped ? "grouped" : "flat"}
    >
      <div className="flex flex-col gap-4 p-1">
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div
            key={sectionIndex}
            className="border-border bg-surface shadow-surface overflow-hidden rounded-xl border"
          >
            <div className="bg-surface-secondary flex items-center gap-2.5 px-3 py-2.5">
              {byStore ? <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" /> : null}
              <Skeleton className={`h-5 rounded-md ${byStore ? "w-32" : "w-48"}`} />
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="ml-auto h-5 w-5 rounded-md" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            </div>

            <div className="border-border divide-border flex flex-col divide-y border-t">
              {Array.from({ length: sectionIndex === 0 ? 4 : 3 }).map((_, itemIndex) => (
                <div key={itemIndex} className="flex min-h-12 items-center gap-3 px-4 py-3 pl-10">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                  <div className="flex max-w-xs flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-full rounded-md" />
                    {withSourceLine ? <Skeleton className="h-3 w-24 rounded-md" /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
