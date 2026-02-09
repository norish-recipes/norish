"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

import { parseTimerDurations } from "@/lib/timer-parser";
import { useTimersEnabledQuery, useTimerKeywordsQuery } from "@/hooks/config";
import { createClientLogger } from "@/lib/logger";
import { TimerChip } from "@/components/recipe/timer-chip";

const logger = createClientLogger("smart-instruction");

interface SmartInstructionProps {
  text: string;
  recipeId: string;
  recipeName?: string;
  stepIndex: number;
}

interface TimerSegmentData {
  timerId: string;
  recipeId: string;
  recipeName?: string;
  label: string;
  durationMs: number;
  originalText: string;
}

type Segment = {
  type: "text" | "timer";
  content: string;
  startIndex: number;
  endIndex: number;
  data?: TimerSegmentData;
};

export function SmartInstruction({ text, recipeId, recipeName, stepIndex }: SmartInstructionProps) {
  const { timersEnabled } = useTimersEnabledQuery();
  const { timerKeywords } = useTimerKeywordsQuery();

  const segments = useMemo(() => {
    const allSegments: Segment[] = [];

    // Parse timers if enabled - memoized to avoid re-parsing on every render
    if (timersEnabled && timerKeywords.enabled) {
      try {
        const timerMatches = parseTimerDurations(text, {
          hours: timerKeywords.hours,
          minutes: timerKeywords.minutes,
          seconds: timerKeywords.seconds,
        });

        timerMatches.forEach((match, idx) => {
          const durationMs = match.durationSeconds * 1000;
          const timerId = `${recipeId}-s${stepIndex}-${idx}`;
          const label = `Step ${stepIndex + 1} Timer`;

          allSegments.push({
            type: "timer",
            content: match.originalText,
            startIndex: match.startIndex,
            endIndex: match.endIndex,
            data: {
              timerId,
              recipeId,
              recipeName,
              label,
              durationMs,
              originalText: match.originalText,
            },
          });
        });
      } catch (error) {
        // Silently handle parser errors to avoid breaking the UI
        logger.warn({ error }, "Timer parsing failed");
      }
    }

    return allSegments;
  }, [text, recipeId, recipeName, stepIndex, timersEnabled, timerKeywords]);

  const processedText = useMemo(() => {
    return preprocessMarkdown(text);
  }, [text]);

  return (
    <span>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <span className="text-foreground mt-2 mb-1 block text-lg font-semibold">
              {children}
            </span>
          ),
          h2: ({ children }) => (
            <span className="text-foreground mt-2 mb-1 block text-lg font-semibold">
              {children}
            </span>
          ),
          a: ({ href, children }) => {
            if (href?.startsWith("/recipes/")) {
              return (
                <Link
                  className="text-foreground decoration-default-400 hover:decoration-default-600 font-medium underline underline-offset-2 transition-colors"
                  href={href}
                  onClick={(e) => e.stopPropagation()}
                >
                  {children}
                </Link>
              );
            }

            return (
              <a
                className="text-foreground decoration-default-400 hover:decoration-default-600 underline underline-offset-2 transition-colors"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </a>
            );
          },
          strong: ({ children }) => {
            if (timersEnabled && timerKeywords.enabled && segments.length > 0) {
              return <strong>{renderWithTimers(children, segments)}</strong>;
            }

            return <strong>{children}</strong>;
          },
          em: ({ children }) => {
            if (timersEnabled && timerKeywords.enabled && segments.length > 0) {
              return <em>{renderWithTimers(children, segments)}</em>;
            }

            return <em>{children}</em>;
          },
          p: ({ children }) => {
            if (timersEnabled && timerKeywords.enabled && segments.length > 0) {
              return <span>{renderWithTimers(children, segments)}</span>;
            }

            return <span>{children}</span>;
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </span>
  );
}

function preprocessMarkdown(text: string): string {
  if (!text) return "";

  let processed = text
    .split("\n")
    .map((line) => {
      if (line.startsWith("#") && !line.startsWith("##")) {
        const content = line.slice(1).trim();

        return `## ${content}`;
      }

      return line;
    })
    .join("\n");

  processed = processed.replace(
    /\[([^\]]+)\]\(id:([a-zA-Z0-9-]+)\)/g,
    (_, recipeName, recipeId) => {
      return `[${recipeName}](/recipes/${recipeId})`;
    }
  );

  return processed;
}

function renderWithTimers(children: any, segments: Segment[]): React.ReactNode {
  if (!children || typeof children === "string") {
    return insertTimers(children || "", segments);
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) => {
      if (typeof child === "string") {
        return <React.Fragment key={`seg-${idx}`}>{insertTimers(child, segments)}</React.Fragment>;
      }

      return <React.Fragment key={`child-${idx}`}>{child}</React.Fragment>;
    });
  }

  return children;
}

function insertTimers(text: string, segments: Segment[]): React.ReactNode[] {
  if (segments.length === 0) {
    return [text];
  }

  const result: React.ReactNode[] = [];
  let currentIndex = 0;

  // Sort segments by start index
  const sortedSegments = [...segments].sort((a, b) => a.startIndex - b.startIndex);

  sortedSegments.forEach((segment) => {
    // Check if this segment's content is in the text starting from currentIndex
    const segmentPosition = text.indexOf(segment.content, currentIndex);

    if (segmentPosition === -1) {
      // Segment not found in this text node, skip
      return;
    }

    // Add text before this segment
    if (currentIndex < segmentPosition) {
      const beforeText = text.substring(currentIndex, segmentPosition);

      if (beforeText) {
        result.push(beforeText);
      }
    }

    // Add the timer chip
    if (segment.data) {
      result.push(
        <TimerChip
          key={`timer-${segment.data.timerId}`}
          durationMs={segment.data.durationMs}
          id={segment.data.timerId}
          initialLabel={segment.data.label}
          originalText={segment.data.originalText}
          recipeId={segment.data.recipeId}
          recipeName={segment.data.recipeName}
        />
      );
    }

    currentIndex = segmentPosition + segment.content.length;
  });

  // Add remaining text
  if (currentIndex < text.length) {
    result.push(text.substring(currentIndex));
  }

  return result.length > 0 ? result : [text];
}
