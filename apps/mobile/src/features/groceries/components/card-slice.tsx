import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useIsLifted } from "@/components/drag-list/drag-list";

import type { Edge } from "../utils/list-rows";

/**
 * One row's slice of its section's card: the card is flat rows, so the heading rounds the top
 * and the last row the bottom. `gap` leaves room above a section's heading.
 */
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
  return (
    <View className={`px-5 ${gap ? "pt-3.5" : ""}`}>
      <View
        className={`overflow-hidden ${className} ${edge.top ? "rounded-t-3xl" : separated ? "border-separator border-t" : ""} ${edge.bottom ? "rounded-b-3xl" : ""}`}
      >
        {children}
      </View>
    </View>
  );
}

const TILT = { transform: [{ rotate: "-1.5deg" }] };

/** A grocery row's slice; while a drag carries it, a card of its own above the list. */
export function ItemSlice({ edge, children }: { edge: Edge; children: ReactNode }) {
  const lifted = useIsLifted();
  const reduceMotion = useReducedMotion();

  if (!lifted) return <CardSlice edge={edge}>{children}</CardSlice>;

  return (
    <View className="px-3.5" style={reduceMotion ? undefined : TILT}>
      <View className="bg-surface rounded-[20px] shadow-lg">{children}</View>
    </View>
  );
}
