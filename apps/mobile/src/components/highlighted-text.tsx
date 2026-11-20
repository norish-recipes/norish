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

/** A recipe title with the search terms highlighted; goes inside a `Text`. */
export function HighlightedTitle({ name, search }: { name: string; search: string }) {
  return <Segments segments={highlightSegments(name, search)} />;
}
