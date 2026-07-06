"use client";

import { useRouter } from "next/navigation";
import FallbackImage from "@/components/shared/fallback-image";
import { PlusIcon } from "@heroicons/react/16/solid";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Card, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { TodayMealSlotCardProps } from "./todays-meals-types";
import { buildPlannedItemSubtitle, getPlannedItemTitle } from "./todays-meals-helpers";
import TodaysMealsSlotChip from "./todays-meals-slot-chip";

const cardClassName = "h-[184px] w-[144px] shrink-0 overflow-hidden rounded-2xl p-0 sm:w-[152px]";
const triggerClassName =
  "group relative grid h-full min-h-0 w-full min-w-0 cursor-[var(--cursor-interactive)] grid-rows-[132px_52px] overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-left focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const mediaClassName = "bg-surface-secondary relative h-[132px] w-full overflow-hidden";
const imageClassName =
  "absolute inset-0 block h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105";
const imageFallbackClassName =
  "bg-surface-secondary text-muted absolute inset-0 flex h-full w-full items-center justify-center transition-transform duration-300 group-hover:scale-105";
const slotChipPositionClassName = "absolute top-2 left-2 z-20 max-w-[calc(100%-1rem)]";
const constrainedSlotChipPositionClassName = "absolute top-2 left-2 z-20 max-w-[calc(100%-4.5rem)]";
const slotChipClassName = "bg-overlay/85 text-foreground backdrop-blur";
const remainingChipClassName =
  "absolute top-2 right-2 z-10 inline-flex w-fit bg-overlay/85 text-foreground backdrop-blur";

export default function TodayMealSlotCard({
  slot,
  slotLabel,
  items,
  onPlan,
}: TodayMealSlotCardProps) {
  const router = useRouter();
  const tCalendar = useTranslations("calendar.timeline");
  const tCalendarPanel = useTranslations("calendar.panel");
  const primaryItem = items[0];
  const remainingCount = Math.max(items.length - 1, 0);
  const isPlanned = Boolean(primaryItem);
  const imageSrc = primaryItem?.itemType === "recipe" ? primaryItem.recipeImage : null;
  const title = getPlannedItemTitle(primaryItem, tCalendar("untitled"));
  const subtitle = buildPlannedItemSubtitle(primaryItem, {
    note: tCalendar("note"),
    serving: tCalendar("serving"),
    servings: tCalendar("servings"),
  });

  const handleOpen = () => {
    if (primaryItem?.itemType === "recipe" && primaryItem.recipeId) {
      router.push(`/recipes/${primaryItem.recipeId}`);

      return;
    }

    if (!primaryItem) {
      onPlan(slot);

      return;
    }

    router.push("/calendar");
  };

  return (
    <Card className={cardClassName} variant={isPlanned ? "default" : "secondary"}>
      <button
        aria-label={isPlanned ? title : `${tCalendarPanel("addRecipe")} ${slotLabel}`}
        className={triggerClassName}
        type="button"
        onClick={handleOpen}
      >
        <div
          className={
            remainingCount > 0 ? constrainedSlotChipPositionClassName : slotChipPositionClassName
          }
        >
          <TodaysMealsSlotChip className={slotChipClassName} slot={slot} slotLabel={slotLabel} />
        </div>

        {isPlanned ? (
          <>
            <div className={mediaClassName}>
              {imageSrc ? (
                <FallbackImage
                  alt={title}
                  className={imageClassName}
                  fallbackClassName={imageFallbackClassName}
                  loading="lazy"
                  src={imageSrc}
                  variant="hero"
                />
              ) : (
                <div className={imageFallbackClassName}>
                  <PhotoIcon aria-hidden="true" className="h-10 w-10 opacity-70" />
                </div>
              )}

              {remainingCount > 0 ? (
                <Chip className={remainingChipClassName} size="sm" variant="soft">
                  +{remainingCount}
                </Chip>
              ) : null}
            </div>

            <Card.Content className="flex h-[52px] w-full flex-col justify-start gap-0.5 overflow-hidden px-2.5 py-1.5">
              <Card.Title
                className="text-foreground w-full min-w-0 truncate text-left text-xs leading-[15px]"
                title={title}
              >
                {title}
              </Card.Title>
              {subtitle ? (
                <Card.Description className="w-full min-w-0 truncate text-left text-[10px] leading-3">
                  {subtitle}
                </Card.Description>
              ) : null}
            </Card.Content>
          </>
        ) : (
          <>
            <div className={mediaClassName} />
            <div className="bg-surface-secondary h-[52px] w-full" />
            <div className="text-muted pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 pt-7 text-center">
              <PlusIcon className="h-6 w-6" />
              <span className="text-foreground text-xs font-medium">
                {tCalendarPanel("addRecipe")}
              </span>
            </div>
          </>
        )}
      </button>
    </Card>
  );
}
