import type { LayoutChangeEvent } from "react-native";
import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";

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
 * A card's tags on one line: the ones that fit, then `+N`. Each chip is measured in a hidden row,
 * plain as glass has the same box, so `fitTags` decides before anything is drawn; the row then goes.
 * `glass` chips sit over a grid card's photo.
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
  // Chip widths by position, for these tags at this window width and font scale.
  const { width: screen, fontScale } = useWindowDimensions();
  const basis = [screen, fontScale, ...tags].join("\n");
  const [measured, setMeasured] = useState<Measured>({ basis, widths: [], more: null });
  const known = measured.basis === basis ? measured : { basis, widths: [], more: null };
  const measure = (update: (known: Measured) => Measured) =>
    setMeasured((last) => update(last.basis === basis ? last : { basis, widths: [], more: null }));
  const widthOf = (index: number) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;

    measure((last) =>
      last.widths[index] === width
        ? last
        : { ...last, widths: Object.assign([...last.widths], { [index]: width }) }
    );
  };
  const { size, tone } = LOOK[look];
  const glass = look === "glass";
  const allergen = (tag: string) => isAllergenTag(tag, allergySet);
  const chip = (tag: string, maxWidth?: number, onGlass = glass) => (
    <Pill
      glass={onGlass}
      icon={allergen(tag) ? "warning-outline" : undefined}
      maxWidth={maxWidth}
      size={size}
      tone={allergen(tag) ? "warning" : tone}
    >
      {tag}
    </Pill>
  );
  const tagWidths = tags.map((_tag, index) => known.widths[index]);
  const allMeasured =
    known.more !== null && tagWidths.every((width): width is number => width !== undefined);
  const fit =
    room !== null && allMeasured && known.more !== null
      ? fitTags(tagWidths, room, TAG_GAP, known.more)
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
              <React.Fragment key={index}>
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
      {allMeasured ? null : (
        <View
          accessibilityElementsHidden
          className="absolute top-0 left-0 flex-row opacity-0"
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {tags.map((tag, index) => (
            <View key={index} onLayout={widthOf(index)}>
              {chip(tag, undefined, false)}
            </View>
          ))}
          <View
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;

              measure((last) => (last.more === width ? last : { ...last, more: width }));
            }}
          >
            <Pill size={size}>{`+${tags.length}`}</Pill>
          </View>
        </View>
      )}
    </View>
  );
}

type Measured = { basis: string; widths: (number | undefined)[]; more: number | null };
