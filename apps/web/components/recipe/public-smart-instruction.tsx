"use client";

/**
 * Share-page-safe variant of SmartInstruction.
 *
 * The original SmartInstruction uses authenticated config hooks via
 * `useTimersEnabledQuery`, which depend on user context.
 * This variant reads the dedicated public share-page config instead and keeps
 * the same visual output.
 */
import React, { useMemo } from "react";
import { TimerChip } from "@/components/recipe/timer-chip";
import { useSharePublicConfigQuery } from "@/hooks/recipes/use-share-public-config-query";
import ReactMarkdown from "react-markdown";

import { createClientLogger } from "@norish/shared/lib/logger";
import { parseTimerDurations } from "@norish/shared/lib/timer-parser";

const logger = createClientLogger("public-smart-instruction");

interface PublicSmartInstructionProps {
  text: string;
  recipeId: string;
  token: string;
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

export function PublicSmartInstruction({
  text,
  recipeId,
  token,
  recipeName,
  stepIndex,
}: PublicSmartInstructionProps) {
  const { timersEnabled, timerKeywords } = useSharePublicConfigQuery(token);

  const segments = useMemo(() => {
    const allSegments: Segment[] = [];

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
            // On share pages, all links open externally
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

  // On share pages, recipe cross-references don't resolve — strip the link
  processed = processed.replace(
    /\[([^\]]+)\]\(id:[a-zA-Z0-9-]+\)/g,
    (_: string, recipeName: string) => recipeName
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

  const sortedSegments = [...segments].sort((a, b) => a.startIndex - b.startIndex);

  sortedSegments.forEach((segment) => {
    const segmentPosition = text.indexOf(segment.content, currentIndex);

    if (segmentPosition === -1) {
      return;
    }

    if (currentIndex < segmentPosition) {
      const beforeText = text.substring(currentIndex, segmentPosition);

      if (beforeText) {
        result.push(beforeText);
      }
    }

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

  if (currentIndex < text.length) {
    result.push(text.substring(currentIndex));
  }

  return result.length > 0 ? result : [text];
}
