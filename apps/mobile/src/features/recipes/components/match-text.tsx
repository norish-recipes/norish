import React from "react";
import { Text } from "react-native";
import { useIntl } from "react-intl";

import type { LibraryMatchDTO } from "@norish/shared/contracts";

import type { MatchSegment } from "../utils/match-line";
import { highlightSegments, matchLine } from "../utils/match-line";

/** Text with the hits on an accent-tinted highlight; goes inside a `Text`. */
function Segments({ segments }: { segments: MatchSegment[] }) {
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

/** Why a recipe matched, in place of its description; goes inside a `Text`. */
export function MatchText({ match, search }: { match: LibraryMatchDTO; search: string }) {
  const intl = useIntl();
  const line = matchLine(match, search);
  const label = line.labelId ? intl.formatMessage({ id: line.labelId }, line.labelValues) : null;

  return (
    <>
      {label}
      {label && line.segments.length > 0 ? " " : null}
      <Segments segments={line.segments} />
    </>
  );
}
