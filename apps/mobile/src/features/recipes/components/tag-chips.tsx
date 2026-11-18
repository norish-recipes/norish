import type { LayoutChangeEvent } from "react-native";
import React, { useState } from "react";
import { View } from "react-native";

import { isAllergenTag } from "@norish/shared/lib/helpers";

import { fitTags } from "../utils/tag-fit";
import { Pill } from "./pill";

// Between chips, and between the row card's facts and its tags.
export const TAG_GAP = 6;

const LOOK = {
  glass: { size: "overlay", tone: "surface" },
  plain: { size: "row", tone: "default" },
} as const;

/**
 * A card's tags on one line: the ones that fit, then `+N`. Each chip is measured once in a hidden
 * row, so `fitTags` decides before anything is drawn. `glass` chips sit over a grid card's photo.
 */
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
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [moreWidth, setMoreWidth] = useState<number | null>(null);
  const { size, tone } = LOOK[look];
  const glass = look === "glass";
  const widthOf = (tag: string) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;

    setWidths((known) => (known[tag] === width ? known : { ...known, [tag]: width }));
  };
  const allergen = (tag: string) => isAllergenTag(tag, allergySet);
  const chip = (tag: string, maxWidth?: number) => (
    <Pill
      glass={glass}
      icon={allergen(tag) ? "warning-outline" : undefined}
      maxWidth={maxWidth}
      size={size}
      tone={allergen(tag) ? "warning" : tone}
    >
      {tag}
    </Pill>
  );
  const tagWidths = tags.map((tag) => widths[tag]);
  const fit =
    room !== null &&
    moreWidth !== null &&
    tagWidths.every((width): width is number => width !== undefined)
      ? fitTags(tagWidths, room, TAG_GAP, moreWidth)
      : null;

  if (tags.length === 0) return null;

  const hidden = fit ? tags.slice(fit.shown) : [];

  return (
    <View
      className={glass ? "absolute inset-x-0 bottom-0 px-2 pb-2" : "min-w-0 flex-1"}
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
              <React.Fragment key={tag}>
                {chip(tag, index === 0 ? fit.firstWidth : undefined)}
              </React.Fragment>
            ))}
            {fit.more ? (
              <Pill glass={glass} size={size} tone={hidden.some(allergen) ? "warning" : tone}>
                {`+${hidden.length}`}
              </Pill>
            ) : null}
          </>
        ) : null}
      </View>
      {/* Measured at their own width: unclipped by the line, out of sight and of the reader. */}
      <View
        accessibilityElementsHidden
        className="absolute top-0 left-0 flex-row opacity-0"
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {tags.map((tag) => (
          <View key={tag} onLayout={widthOf(tag)}>
            {chip(tag)}
          </View>
        ))}
        <View onLayout={(event) => setMoreWidth(event.nativeEvent.layout.width)}>
          <Pill size={size}>{`+${tags.length}`}</Pill>
        </View>
      </View>
    </View>
  );
}
