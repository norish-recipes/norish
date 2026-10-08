"use client";

import type { ComponentType, ReactNode } from "react";
import { ScrollShadow } from "@heroui/react";

/**
 * One fact a card states: a muted icon and its value in the card's own text
 * colour, with no fill of its own, so it reads on a dark card as well as a
 * light one.
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
    <span className="text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums">
      {Icon ? <Icon className={`size-3.5 ${iconClassName}`} /> : null}
      {children}
    </span>
  );
}

/**
 * A grid card's facts along its foot: every one on one line, which scrolls
 * sideways where the card is too narrow for them all. A finger that scrolls
 * them is not swiping the card open; where they all fit, it is.
 */
export function CardFacts({ children }: { children: ReactNode }) {
  return (
    <ScrollShadow
      hideScrollBar
      className="mt-auto shrink-0 pt-3"
      orientation="horizontal"
      size={24}
      onPointerDown={(e) => {
        if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) e.stopPropagation();
      }}
    >
      <div className="flex w-max items-center gap-3">{children}</div>
    </ScrollShadow>
  );
}
