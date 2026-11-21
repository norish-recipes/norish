"use client";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Card, Separator, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

/** The day card's add button, drawn but inert. */
function AddButtonPlaceholder() {
  return (
    <span className="bg-surface-secondary text-muted flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm">
      <PlusIcon className="size-4" />
    </span>
  );
}

/**
 * A phone day: its header only, as an empty day draws. The timeline lands on today; dates
 * stay grey because the server doesn't know the reader's time zone.
 */
function PhoneDaySkeleton({ isToday }: { isToday: boolean }) {
  const t = useTranslations("calendar.mobile");

  return (
    <div className="py-1">
      <Card className={`p-3 ${isToday ? "ring-accent/50 shadow-md ring-2" : "shadow-sm"}`}>
        <Card.Content className="flex flex-row items-center justify-between gap-3 p-0">
          <div className="flex min-w-0 items-center gap-2">
            {isToday ? (
              <>
                <span className="text-accent text-base font-semibold">{t("today")}</span>
                <Skeleton className="h-4 w-24 rounded" />
              </>
            ) : (
              <Skeleton className="h-5 w-28 rounded" />
            )}
          </div>
          <AddButtonPlaceholder />
        </Card.Content>
      </Card>
    </div>
  );
}

export function CalendarSkeletonMobile() {
  return (
    <div className="flex flex-col" data-calendar-skeleton="phone">
      {Array.from({ length: 10 }, (_, i) => (
        <PhoneDaySkeleton key={i} isToday={i === 0} />
      ))}
    </div>
  );
}

function DesktopItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

function DesktopDayCardSkeleton() {
  return (
    <Card className="shadow-sm" style={{ height: 400 }}>
      <Card.Content className="flex flex-col gap-2 overflow-hidden px-4 py-3">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 py-0.5">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <AddButtonPlaceholder />
        </div>

        <Separator className="shrink-0" />

        <div className="flex flex-col py-2">
          <DesktopItemSkeleton />
          <DesktopItemSkeleton />
        </div>
      </Card.Content>
    </Card>
  );
}

export function CalendarSkeletonDesktop() {
  return (
    <div className="overflow-hidden px-4 py-2" data-calendar-skeleton="desktop">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <DesktopDayCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** The calendar route's skeleton, in the layout the page will pick. */
export default function CalendarSkeleton() {
  return useIsMobile() ? <CalendarSkeletonMobile /> : <CalendarSkeletonDesktop />;
}
