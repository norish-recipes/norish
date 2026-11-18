import React, { useState } from "react";
import { View } from "react-native";

import { isAllergenTag } from "@norish/shared/lib/helpers";

import { fitTags } from "../utils/tag-fit";
import { Pill } from "./pill";

const GAP = 6;

/**
 * A grid card's tags as glass chips along the photo's foot: the ones that fit, then `+N`. Each chip
 * is measured once in a hidden row, so `fitTags` decides before anything is drawn.
 */
export function TagChips({
  tags,
  allergySet,
  testID,
}: {
  tags: string[];
  allergySet: Set<string>;
  testID: string;
}) {
  const [room, setRoom] = useState<number | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const moreKey = "+";
  const widthOf = (key: string) => (event: { nativeEvent: { layout: { width: number } } }) => {
    const { width } = event.nativeEvent.layout;

    setWidths((known) => (known[key] === width ? known : { ...known, [key]: width }));
  };
  const chip = (tag: string, glass: boolean) => {
    const allergen = isAllergenTag(tag, allergySet);

    return (
      <Pill
        glass={glass}
        icon={allergen ? "warning-outline" : undefined}
        size="overlay"
        tone={allergen ? "warning" : "surface"}
      >
        {tag}
      </Pill>
    );
  };
  const measured =
    room !== null &&
    tags.every((tag) => widths[tag] !== undefined) &&
    widths[moreKey] !== undefined;
  const shown = measured
    ? fitTags(
        tags.map((tag) => widths[tag] ?? 0),
        room,
        GAP,
        widths[moreKey] ?? 0
      )
    : 0;
  const hidden = tags.slice(shown);

  if (tags.length === 0) return null;

  return (
    <View className="absolute inset-x-0 bottom-0 px-2 pb-2" pointerEvents="none" testID={testID}>
      <View
        className="flex-row"
        style={{ gap: GAP }}
        onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      >
        {measured ? (
          <>
            {tags.slice(0, shown).map((tag) => (
              <React.Fragment key={tag}>{chip(tag, true)}</React.Fragment>
            ))}
            {hidden.length > 0 ? (
              <Pill
                glass
                size="overlay"
                tone={hidden.some((tag) => isAllergenTag(tag, allergySet)) ? "warning" : "surface"}
              >
                {`+${hidden.length}`}
              </Pill>
            ) : null}
          </>
        ) : null}
      </View>
      <View
        accessibilityElementsHidden
        className="absolute bottom-0 left-2 flex-row opacity-0"
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ gap: GAP }}
      >
        {tags.map((tag) => (
          <View key={tag} onLayout={widthOf(tag)}>
            {chip(tag, false)}
          </View>
        ))}
        <View onLayout={widthOf(moreKey)}>
          <Pill size="overlay">{`+${tags.length}`}</Pill>
        </View>
      </View>
    </View>
  );
}
