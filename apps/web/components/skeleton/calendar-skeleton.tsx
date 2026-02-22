"use client";

import { Skeleton } from "@heroui/react";

function DaySkeletonItem() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

function DaySectionSkeleton() {
  return (
    <div className="border-default-100 border-b px-4 py-4">
      {/* Day header */}
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Slot items */}
      <div className="flex flex-col gap-2">
        <DaySkeletonItem />
        <DaySkeletonItem />
      </div>
    </div>
  );
}

export function CalendarSkeletonMobile() {
  return (
    <div className="flex h-full flex-col">
      <DaySectionSkeleton />
      <DaySectionSkeleton />
      <DaySectionSkeleton />
      <DaySectionSkeleton />
      <DaySectionSkeleton />
    </div>
  );
}

function DesktopDayCardSkeleton() {
  return (
    <div className="bg-content1 flex h-[400px] flex-col gap-2 rounded-xl p-4 shadow-sm">
      {/* Day header */}
      <div className="flex shrink-0 items-start justify-between">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-24 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <Skeleton className="h-px w-full shrink-0" />

      {/* Items */}
      <div className="flex flex-col gap-2">
        <DaySkeletonItem />
        <DaySkeletonItem />
        <DaySkeletonItem />
      </div>
    </div>
  );
}

export function CalendarSkeletonDesktop() {
  return (
    <div className="h-full overflow-hidden px-4 py-2">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <DesktopDayCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function CalendarSkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden h-full md:block">
        <CalendarSkeletonDesktop />
      </div>

      {/* Mobile skeleton */}
      <div className="block h-full md:hidden">
        <CalendarSkeletonMobile />
      </div>
    </>
  );
}
