import type { Edge } from "@/lib/card-edges";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useDragCard, useIsLifted } from "@/components/drag-list/drag-list";
import { useOnSheet } from "@/components/on-sheet";

/** One row's slice of its section's card: the card is flat rows, so the heading rounds the top
 * and the last row the bottom. `gap` leaves room above a section's heading. */
export function CardSlice({
  edge,
  gap = false,
  separated = true,
  className,
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
  const ground = useSliceFill();
  const fill = className ?? ground;

  return (
    <View className={`px-5 ${gap ? "pt-3.5" : ""}`}>
      <View className={sliceClass(edge, fill, separated)} onLayout={onCardLayout}>
        {children}
      </View>
    </View>
  );
}

/** A slice's ground: the translucent fill on a sheet, the surface off one. */
const useSliceFill = () => (useOnSheet() ? "bg-sand" : "bg-surface");

/** A page's cards, and a sheet's tighter ones; `lifted` is the card a drag carries. */
const SIZES: Record<
  "page" | "sheet",
  { inset: string; liftedInset?: string; top: string; bottom: string; lifted: string }
> = {
  page: {
    inset: "px-5",
    liftedInset: "px-3.5",
    top: "rounded-t-3xl",
    bottom: "rounded-b-3xl",
    lifted: "rounded-[20px]",
  },
  sheet: {
    inset: "px-4",
    top: "rounded-t-[22px]",
    bottom: "rounded-b-[22px]",
    lifted: "rounded-[22px]",
  },
};

const sliceClass = (
  edge: Edge,
  className: string,
  separated: boolean,
  size: (typeof SIZES)[keyof typeof SIZES] = SIZES.page
) =>
  `overflow-hidden ${className} ${edge.top ? size.top : separated ? "border-separator border-t" : ""} ${edge.bottom ? size.bottom : ""}`;

const TILT = { transform: [{ rotate: "-1.5deg" }] };

/** An item row's slice; in the card a drag carries, a card of its own. */
export function ItemSlice({
  edge,
  separated = true,
  className,
  size = "page",
  children,
}: {
  edge: Edge;
  separated?: boolean;
  className?: string;
  size?: keyof typeof SIZES;
  children: ReactNode;
}) {
  const lifted = useIsLifted();
  const reduceMotion = useReducedMotion();
  const onCardLayout = useDragCard();
  const sized = SIZES[size];
  const ground = useSliceFill();
  const fill = className ?? ground;

  return (
    <View
      className={lifted ? (sized.liftedInset ?? sized.inset) : sized.inset}
      style={lifted && !reduceMotion ? TILT : undefined}
    >
      <View
        className={
          lifted
            ? `overflow-hidden ${fill} ${sized.lifted}`
            : sliceClass(edge, fill, separated, sized)
        }
        onLayout={onCardLayout}
      >
        {children}
      </View>
    </View>
  );
}
