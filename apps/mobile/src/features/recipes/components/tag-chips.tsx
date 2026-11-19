import type { LayoutChangeEvent } from "react-native";
import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Pill } from "@/components/pill";

import { isAllergenTag } from "@norish/shared/lib/helpers";

import { fitTags } from "../utils/tag-fit";

// Between chips, and between the row card's facts and its tags.
export const TAG_GAP = 6;

const LOOK = {
  photo: { size: "overlay", tone: "surface" },
  plain: { size: "row", tone: "default" },
} as const;

/** Chip widths by size, font scale, allergen look and text, measured once for every card. */
const chipWidths = new Map<string, number>();

/** A card's tags on one line, then `+N`: a hidden row measures each chip not yet in `chipWidths`
 * so `fitTags` decides before drawing. `photo` chips sit over a grid card's photo. */
export function TagChips({
  tags,
  allergySet,
  look,
  testID,
}: {
  tags: string[];
  allergySet: Set<string>;
  look: keyof typeof LOOK;
  testID: string;
}) {
  const [room, setRoom] = useState<number | null>(null);
  // This card's own measurements: the compiler would not see the shared map change.
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const { fontScale } = useWindowDimensions();
  const allergen = (tag: string) => isAllergenTag(tag, allergySet);
  const { size, tone } = LOOK[look];
  const tagKeys = tags.map((tag) => `${size}\n${fontScale}\n${allergen(tag)}\n${tag}`);
  // Apart from the tags, so a tag named +2 keeps its own width.
  const moreKey = `${size}\n${fontScale}\nmore\n${tags.length}`;
  const widthOf = (key: string) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;

    chipWidths.set(key, width);
    setMeasured((last) => (last[key] === width ? last : { ...last, [key]: width }));
  };
  const known = (key: string) => measured[key] ?? chipWidths.get(key);
  const chip = (tag: string, maxWidth?: number) => (
    <Pill
      icon={allergen(tag) ? "warning-outline" : undefined}
      maxWidth={maxWidth}
      size={size}
      tone={allergen(tag) ? "warning" : tone}
    >
      {tag}
    </Pill>
  );
  const tagWidths = tagKeys.map(known);
  const moreWidth = known(moreKey);
  const allMeasured =
    moreWidth !== undefined && tagWidths.every((width): width is number => width !== undefined);
  const fit = room !== null && allMeasured ? fitTags(tagWidths, room, TAG_GAP, moreWidth) : null;

  if (tags.length === 0) return null;

  const hidden = fit ? tags.slice(fit.shown) : [];

  return (
    <View
      className={look === "photo" ? "absolute inset-x-0 bottom-0 px-2 pb-2" : "min-w-0 flex-1"}
      pointerEvents="none"
      testID={testID}
    >
      <View
        className="flex-row"
        style={{ gap: TAG_GAP }}
        onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      >
        {fit ? (
          <>
            {tags.slice(0, fit.shown).map((tag, index) => (
              <React.Fragment key={index}>
                {chip(tag, index === 0 ? fit.firstWidth : undefined)}
              </React.Fragment>
            ))}
            {fit.more ? (
              <Pill size={size} tone={hidden.some(allergen) ? "warning" : tone}>
                {`+${hidden.length}`}
              </Pill>
            ) : null}
          </>
        ) : null}
      </View>
      {/* Measured at their own width: unclipped by the line, out of sight and of the reader. */}
      {allMeasured ? null : (
        <View
          accessibilityElementsHidden
          className="absolute top-0 left-0 flex-row opacity-0"
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {tags.map((tag, index) => (
            <View key={index} onLayout={widthOf(tagKeys[index] ?? "")}>
              {chip(tag)}
            </View>
          ))}
          <View onLayout={widthOf(moreKey)}>
            <Pill size={size}>{`+${tags.length}`}</Pill>
          </View>
        </View>
      )}
    </View>
  );
}
