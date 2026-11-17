import type { Edge } from "@/lib/card-edges";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useDragCard, useIsLifted } from "@/components/drag-list/drag-list";

/** One row's slice of its section's card: the card is flat rows, so the heading rounds the top
 * and the last row the bottom. `gap` leaves room above a section's heading. */
export function CardSlice({
  edge,
  gap = false,
  separated = true,
  className = "bg-surface",
  children,
}: {
  edge: Edge;
  gap?: boolean;
  /** A hairline above, except on the heading. */
  separated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const onCardLayout = useDragCard();

  return (
    <View className={`px-5 ${gap ? "pt-3.5" : ""}`}>
      <View className={sliceClass(edge, className, separated)} onLayout={onCardLayout}>
        {children}
      </View>
    </View>
  );
}

const sliceClass = (edge: Edge, className: string, separated: boolean) =>
  `overflow-hidden ${className} ${edge.top ? "rounded-t-3xl" : separated ? "border-separator border-t" : ""} ${edge.bottom ? "rounded-b-3xl" : ""}`;

const TILT = { transform: [{ rotate: "-1.5deg" }] };

/** An item row's slice; in the card a drag carries, a card of its own. */
export function ItemSlice({
  edge,
  separated = true,
  className = "bg-surface",
  children,
}: {
  edge: Edge;
  separated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const lifted = useIsLifted();
  const reduceMotion = useReducedMotion();
  const onCardLayout = useDragCard();

  return (
    <View className={lifted ? "px-3.5" : "px-5"} style={lifted && !reduceMotion ? TILT : undefined}>
      <View
        className={lifted ? "bg-surface rounded-[20px]" : sliceClass(edge, className, separated)}
        onLayout={onCardLayout}
      >
        {children}
      </View>
    </View>
  );
}
