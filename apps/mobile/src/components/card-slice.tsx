import type { Edge } from "@/lib/card-edges";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useDragCard, useIsCarried, useIsLifted } from "@/components/drag-list/drag-list";
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
  // A sheet's body owns the side inset.
  const inset = useOnSheet() ? "" : "px-5";

  return (
    <View className={`${inset} ${gap ? "pt-3.5" : ""}`}>
      <View className={sliceClass(edge, fill, separated)} onLayout={onCardLayout}>
        {children}
      </View>
    </View>
  );
}

/** A slice's ground: sand on a sheet, the surface off one. */
const useSliceFill = () => (useOnSheet() ? "bg-sand" : "bg-surface");

/** A page's cards, and a sheet's tighter ones; `lifted` is the pill a lifted row becomes. */
const SIZES: Record<
  "page" | "sheet",
  { inset: string; liftedInset?: string; top: string; bottom: string; lifted: string }
> = {
  page: {
    inset: "px-5",
    liftedInset: "px-3.5",
    top: "rounded-t-3xl",
    bottom: "rounded-b-3xl",
    lifted: "rounded-[32px]",
  },
  sheet: {
    inset: "px-4",
    top: "rounded-t-[22px]",
    bottom: "rounded-b-[22px]",
    lifted: "rounded-[28px]",
  },
};

const sliceClass = (
  edge: Edge,
  className: string,
  separated: boolean,
  size: (typeof SIZES)[keyof typeof SIZES] = SIZES.page
) =>
  `overflow-hidden ${className} ${edge.top ? size.top : separated ? "border-line border-t" : ""} ${edge.bottom ? size.bottom : ""}`;

const TILT = { transform: [{ rotate: "-1.5deg" }] };

/** An item row's slice; lifted, a pill of its own: the carried one widens, tilts and casts the
 * shadow, the faded copy where it lands stays flat, in the cell's inset and height. */
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
  const carried = useIsCarried();
  const reduceMotion = useReducedMotion();
  const onCardLayout = useDragCard();
  const sized = SIZES[size];
  const ground = useSliceFill();
  const fill = className ?? ground;

  // The pill keeps the slice's hairline as a clear border, so the faded copy's cell never resizes.
  const hairline = !edge.top && separated ? "border-t border-transparent" : "";

  return (
    <View
      className={carried ? (sized.liftedInset ?? sized.inset) : sized.inset}
      style={carried && !reduceMotion ? TILT : undefined}
    >
      {/* Unflattened: as the faded copy restyles at the lift, Fabric would otherwise re-parent the
          row's views, and that cancels the hold's gesture. */}
      <View
        className={
          lifted
            ? `${fill} ${sized.lifted} ${hairline} ${carried ? "shadow-lg" : "overflow-hidden"}`
            : sliceClass(edge, fill, separated, sized)
        }
        collapsable={false}
        onLayout={onCardLayout}
      >
        {/* The carried pill's shadow would be clipped with it, so its row clips one level down. */}
        {carried ? <View className={`overflow-hidden ${sized.lifted}`}>{children}</View> : children}
      </View>
    </View>
  );
}
