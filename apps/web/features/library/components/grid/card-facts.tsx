"use client";

import type { ComponentType, ReactNode } from "react";
import { Chip, ScrollShadow } from "@heroui/react";

/**
 * One fact a card states, as a chip: a muted icon and its value, drawn like
 * the tag chips beside it in a list row. A dark card is barely darker than the
 * chip's own fill, so there it takes the next surface up.
 */
export function CardFact({
  icon: Icon,
  iconClassName = "text-muted",
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  children: ReactNode;
}) {
  return (
    <Chip
      className="dark:bg-surface-tertiary shrink-0 gap-1 rounded-full px-1.5 text-[11px] tabular-nums sm:px-2"
      size="sm"
      variant="tertiary"
    >
      {Icon ? <Icon className={`size-3 sm:size-3.5 ${iconClassName}`} /> : null}
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

/**
 * A grid card's facts along its foot, under a hairline as wide as the text:
 * every one on one line, which scrolls sideways where the card is too
 * narrow for them all. A finger that scrolls them is not swiping the card
 * open; where they all fit, it is.
 */
export function CardFacts({ children }: { children: ReactNode }) {
  return (
    <ScrollShadow
      hideScrollBar
      className="border-border mt-auto shrink-0 border-t pt-2.5 sm:pt-3"
      orientation="horizontal"
      size={24}
      onPointerDown={(e) => {
        if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) e.stopPropagation();
      }}
    >
      <div className="flex w-max items-center gap-1 sm:gap-1.5">{children}</div>
    </ScrollShadow>
  );
}
