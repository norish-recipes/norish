import React from "react";
import { View } from "react-native";

/** Where a row sits in its card, for a virtualised list whose rows are the card's slices. */
export type RowPosition = { first: boolean; last: boolean };

/** A slice row's classes: sand, 52 pt (60 `tall`, with a picture), the card's corners on its first and last row. */
export const sliceRowClass = ({ first, last }: RowPosition, tall = false) =>
  `bg-sand ${tall ? "min-h-[60px]" : "min-h-[52px]"} flex-row items-center gap-3 px-4 ${first ? "rounded-t-[22px]" : ""} ${last ? "rounded-b-[22px]" : ""}`;

/** A slice row's hairline above all but the first, from its label (after the picture, if `tall`) to the card's edge. */
export function SliceHairline({ first, tall = false }: { first: boolean; tall?: boolean }) {
  return first ? null : (
    <View className={`bg-line absolute top-0 right-0 h-px ${tall ? "left-[68px]" : "left-4"}`} />
  );
}
