import type { MatchSegment } from "@/lib/highlight-segments";
import React from "react";
import { Text } from "react-native";
import { highlightSegments } from "@/lib/highlight-segments";

/** Text with the hits on an accent-tinted highlight; goes inside a `Text`. */
export function Segments({ segments }: { segments: MatchSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <Text key={index} className="bg-accent-soft text-accent-text">
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </>
  );
}

/** A text (a title, an Ingredient, Tag or Category name) with the search terms highlighted; goes inside a `Text`. */
export function HighlightedText({ text, search }: { text: string; search: string }) {
  return <Segments segments={highlightSegments(text, search)} />;
}
