import React, { useMemo } from "react";
import { Text } from "react-native";
import { useTimerKeywordsQuery, useTimersEnabledQuery } from "@/hooks/config";

import { parseTimerDurations } from "@norish/shared/lib/timer-parser";

import type { SmartTextProps, TopSegment } from "./types";
import { stripMarkdownForTimerDetection } from "./parse-blocks";
import { RichTextBlock } from "./rich-text-block";
import { TimerChipInline } from "./timer-chip-inline";

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SmartText renders text with inline markdown-like formatting for React Native.
 *
 * Supported syntax:
 * - `**bold**` or `__bold__`
 * - `*italic*` or `_italic_`
 * - `***bold italic***`
 * - `[link text](url)` or `[link text](id:recipe-id)`
 * - `# Heading` (line-level, rendered as styled heading text)
 * - Timer highlighting: uses the shared `parseTimerDurations` parser from
 *   `@norish/shared` with server-configured keywords via `useTimerKeywordsQuery`.
 *   Markdown is stripped before detection so `**5 minutes**` is correctly
 *   recognised. Timer expressions are rendered as inline text badges that
 *   flow naturally within the surrounding text.
 */
export function SmartText({
  children: text,
  style,
  disableLinks = false,
  highlightTimers = false,
  timerContext,
  textProps,
}: SmartTextProps) {
  // Use shared hooks for timer config
  const { timersEnabled } = useTimersEnabledQuery();
  const { timerKeywords } = useTimerKeywordsQuery();

  const shouldHighlightTimers = highlightTimers && timersEnabled && timerKeywords.enabled;

  // Parse timer segments using the shared parser on markdown-stripped text
  const segments = useMemo<TopSegment[]>(() => {
    if (!shouldHighlightTimers) return [];

    try {
      // Strip markdown so **5 minutes** is detected as "5 minutes"
      const { plain, toOriginal } = stripMarkdownForTimerDetection(text);

      const matches = parseTimerDurations(plain, {
        hours: timerKeywords.hours,
        minutes: timerKeywords.minutes,
        seconds: timerKeywords.seconds,
      });

      if (matches.length === 0) return [];

      // Build segments by mapping plain-text positions back to the original
      const result: TopSegment[] = [];
      let lastOriginalEnd = 0;

      for (const [idx, match] of matches.entries()) {
        // Map plain-text indices → original-text indices
        let origStart = toOriginal[match.startIndex]!;
        let origEnd = toOriginal[match.endIndex]!;

        // Expand range to consume surrounding markdown delimiters
        // e.g. **5 minutes** → include the ** on both sides
        const leadingDelimiters = text.slice(0, origStart).match(/[*_]+$/);
        if (leadingDelimiters) {
          origStart -= leadingDelimiters[0].length;
        }
        const trailingDelimiters = text.slice(origEnd).match(/^[*_]+/);
        if (trailingDelimiters) {
          origEnd += trailingDelimiters[0].length;
        }

        // Text before this timer (in the original, with markdown intact)
        if (origStart > lastOriginalEnd) {
          const before = text.slice(lastOriginalEnd, origStart);
          if (before.length > 0) {
            result.push({ type: "richtext", content: before });
          }
        }

        // Timer segment — use the plain-text matched content (no markdown)
        const timerId = timerContext
          ? `${timerContext.recipeId}-s${timerContext.stepIndex}-${idx}`
          : `timer-${idx}`;

        result.push({
          type: "timer",
          originalText: match.originalText,
          durationMs: match.durationSeconds * 1000,
          timerId,
          label: timerContext ? `Step ${timerContext.stepIndex + 1} Timer` : match.label,
        });

        lastOriginalEnd = origEnd;
      }

      // Remaining text after last timer
      if (lastOriginalEnd < text.length) {
        result.push({ type: "richtext", content: text.slice(lastOriginalEnd) });
      }

      return result;
    } catch {
      // Silently handle parser errors
      return [];
    }
  }, [text, shouldHighlightTimers, timerKeywords, timerContext]);

  const hasTimers = segments.length > 0;

  // ── No timers: pure Text rendering ──────────────────────────────────────

  if (!hasTimers) {
    return (
      <RichTextBlock text={text} style={style} disableLinks={disableLinks} textProps={textProps} />
    );
  }

  // ── Has timers: single <Text> tree with inline timer badges ─────────────
  // Everything is nested inside one <Text> so text and timer badges flow
  // naturally on the same line, wrapping at word boundaries.

  return (
    <Text style={style} {...textProps}>
      {segments.map((seg, i) => {
        if (seg.type === "timer") {
          return (
            <TimerChipInline
              key={`timer-${i}`}
              text={seg.originalText}
              timerId={seg.timerId}
              durationMs={seg.durationMs}
              label={seg.label}
              recipeId={timerContext?.recipeId}
              recipeName={timerContext?.recipeName}
            />
          );
        }

        return (
          <RichTextBlock
            key={`text-${i}`}
            text={seg.content}
            style={style}
            disableLinks={disableLinks}
            asFragment
          />
        );
      })}
    </Text>
  );
}
