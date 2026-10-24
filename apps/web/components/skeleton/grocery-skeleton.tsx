"use client";

import { useDevicePreference } from "@/context/device-preferences-context";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { Bars3Icon, ChevronDownIcon, EllipsisVerticalIcon } from "@heroicons/react/16/solid";
import { Skeleton } from "@heroui/react";

/**
 * The list before it arrives, in the reader's view and grouping: one card per section,
 * a Store's with its dot and kebab.
 */
export default function GrocerySkeleton() {
  const [view] = useDevicePreference("groceryViewMode");
  const [grouped] = useDevicePreference("groceryGroupSimilar");
  const byStore = view === "store";
  // A grouped row carries its drag handle in line; a single row keeps it in its padding.
  const groupedRows = byStore && grouped;
  const { showIngredientIcons } = useHiddenItemVisibility();

  return (
    <div
      className="flex flex-col gap-4 p-1"
      data-grocery-skeleton={view}
      data-grocery-skeleton-grouping={groupedRows ? "grouped" : "flat"}
    >
      {[4, 3, 3].map((rows, sectionIndex) => (
        <div
          key={sectionIndex}
          className="border-border bg-surface shadow-surface overflow-hidden rounded-xl border"
        >
          <div className="bg-surface-secondary flex w-full items-center gap-2 px-3 py-2.5">
            {byStore && (
              <span className="flex size-4 shrink-0 items-center justify-center">
                <Skeleton className="size-2.5 rounded-full" />
              </span>
            )}
            <Skeleton className={`h-5 rounded-md ${byStore ? "w-32" : "w-48"}`} />
            <Skeleton className="h-4 w-14 rounded-md" />
            <ChevronDownIcon className="text-muted ml-auto size-5 shrink-0" />
            {byStore && (
              <span className="text-muted flex size-8 shrink-0 items-center justify-center">
                <EllipsisVerticalIcon className="size-5" />
              </span>
            )}
          </div>

          <div className="border-border divide-border divide-y border-t">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className={`bg-surface relative flex min-h-12 items-center gap-3 px-4 py-3 ${groupedRows ? "" : "sm:pl-10"}`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center max-sm:hidden ${groupedRows ? "" : "absolute top-1/2 left-2 -translate-y-1/2"}`}
                >
                  <Bars3Icon className="text-muted/60 size-4" />
                </span>
                <Skeleton className="size-6 shrink-0 rounded-full" />
                {showIngredientIcons && (
                  <Skeleton className="size-6 shrink-0 rounded-full max-sm:hidden md:size-8" />
                )}
                <Skeleton className="h-4 w-40 max-w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
