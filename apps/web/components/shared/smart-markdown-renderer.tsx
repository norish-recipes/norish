"use client";

import Link from "next/link";
import { TimerChip } from "@/components/recipe/timer-chip";
import ReactMarkdown from "react-markdown";

import type { IngredientLinkCandidate } from "@norish/shared-react/text";
import type { TimerKeywords, TimerMatch } from "@norish/shared/lib/timer-parser";
import {
  applyIngredientLinkMarkup,
  isIngredientLinkHref,
  parseIngredientLinkHref,
} from "@norish/shared-react/text";
import { createClientLogger } from "@norish/shared/lib/logger";
import { parseTimerDurations } from "@norish/shared/lib/timer-parser";

const logger = createClientLogger("smart-markdown-renderer");
const TIMER_HREF_PREFIX = "norish-timer:";
const MARKDOWN_LABEL_ESCAPE = /[\\\[\]]/g;

export type SmartMarkdownLinkMode = "private" | "public" | "disabled";

export type SmartMarkdownTimerConfig = {
  enabled: boolean;
  recipeId: string;
  recipeName?: string;
  stepIndex: number;
  keywords?: TimerKeywords;
};

export interface SmartMarkdownRendererProps {
  text: string;
  className?: string;
  disableLinks?: boolean;
  linkMode?: SmartMarkdownLinkMode;
  ingredientCandidates?: IngredientLinkCandidate[];
  timerConfig?: SmartMarkdownTimerConfig;
  onIngredientPress?: (candidate: IngredientLinkCandidate) => void;
}

/**
 * Renders text with smart markdown processing:
 * - #heading renders as styled heading
 * - /recipe-name renders as clickable link to recipe
 * - @ingredient references render as ingredient links when candidates are supplied
 * - timer durations render as timer chips when timerConfig is enabled
 */
export default function SmartMarkdownRenderer({
  text,
  className = "",
  disableLinks = false,
  linkMode,
  ingredientCandidates = [],
  timerConfig,
  onIngredientPress,
}: SmartMarkdownRendererProps) {
  const resolvedLinkMode: SmartMarkdownLinkMode = disableLinks
    ? "disabled"
    : (linkMode ?? "private");
  const candidateByKey = new Map(
    ingredientCandidates.map((candidate) => [candidate.key, candidate])
  );
  const timerMatches = parseTimerMatches(text, timerConfig);
  const timerByHrefKey = new Map(
    timerMatches.map((match, index) => [
      String(index),
      {
        durationMs: match.durationSeconds * 1000,
        id: `${timerConfig?.recipeId ?? "recipe"}-s${timerConfig?.stepIndex ?? 0}-${index}`,
        label: `Step ${(timerConfig?.stepIndex ?? 0) + 1} Timer`,
        originalText: match.originalText,
      },
    ])
  );
  const processedText = preprocessText(
    applyIngredientLinkMarkup(applyTimerMarkup(text, timerMatches), ingredientCandidates),
    resolvedLinkMode
  );

  return (
    <span className={className}>
      <ReactMarkdown
        urlTransform={transformMarkdownUrl}
        components={{
          // Style headings distinctly (matching card headers)
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
            if (href?.startsWith(TIMER_HREF_PREFIX)) {
              const timer = timerByHrefKey.get(href.slice(TIMER_HREF_PREFIX.length));

              if (!timer || resolvedLinkMode === "disabled" || !timerConfig) {
                return (
                  <span className="text-foreground decoration-muted underline underline-offset-2">
                    {children}
                  </span>
                );
              }

              return (
                <TimerChip
                  durationMs={timer.durationMs}
                  id={timer.id}
                  initialLabel={timer.label}
                  originalText={timer.originalText}
                  recipeId={timerConfig.recipeId}
                  recipeName={timerConfig.recipeName}
                />
              );
            }

            if (isIngredientLinkHref(href)) {
              const key = parseIngredientLinkHref(href);
              const candidate = key ? candidateByKey.get(key) : null;

              if (!candidate || resolvedLinkMode === "disabled") {
                return (
                  <span className="text-accent decoration-accent/50 font-medium underline underline-offset-2">
                    {children}
                  </span>
                );
              }

              return (
                <button
                  className="text-accent decoration-accent/50 hover:decoration-accent inline font-medium underline underline-offset-2 transition-colors"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onIngredientPress?.(candidate);
                  }}
                >
                  {children}
                </button>
              );
            }

            if (href?.startsWith("/recipes/")) {
              if (resolvedLinkMode !== "private") {
                return (
                  <span className="text-foreground decoration-muted font-medium underline underline-offset-2">
                    {children}
                  </span>
                );
              }

              return (
                <Link
                  className="text-foreground decoration-muted hover:decoration-foreground font-medium underline underline-offset-2 transition-colors"
                  href={href}
                  onClick={(e) => e.stopPropagation()}
                >
                  {children}
                </Link>
              );
            }

            if (resolvedLinkMode === "disabled" || !href) {
              return (
                <span className="text-foreground decoration-muted underline underline-offset-2">
                  {children}
                </span>
              );
            }

            return (
              <a
                className="text-foreground decoration-muted hover:decoration-foreground underline underline-offset-2 transition-colors"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </a>
            );
          },

          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </span>
  );
}

function preprocessText(text: string, linkMode: SmartMarkdownLinkMode): string {
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

  if (linkMode === "private") {
    processed = processed.replace(
      /\[([^\]]+)\]\(id:([a-zA-Z0-9-]+)\)/g,
      (_, recipeName, recipeId) => {
        return `[${recipeName}](/recipes/${recipeId})`;
      }
    );
  } else {
    processed = processed.replace(
      /\[([^\]]+)\]\(id:[a-zA-Z0-9-]+\)/g,
      (_: string, recipeName: string) => recipeName
    );
  }

  return processed;
}

function parseTimerMatches(
  text: string,
  timerConfig: SmartMarkdownTimerConfig | undefined
): TimerMatch[] {
  if (!timerConfig?.enabled) return [];

  try {
    return parseTimerDurations(text, timerConfig.keywords);
  } catch (error) {
    logger.warn({ error }, "Timer parsing failed");
    return [];
  }
}

function applyTimerMarkup(text: string, timerMatches: TimerMatch[]): string {
  if (timerMatches.length === 0) return text;

  let result = "";
  let currentIndex = 0;

  timerMatches
    .slice()
    .sort((a, b) => a.startIndex - b.startIndex)
    .forEach((match, index) => {
      if (match.startIndex < currentIndex) return;

      result += text.slice(currentIndex, match.startIndex);
      result += `[${escapeMarkdownLabel(match.originalText)}](${TIMER_HREF_PREFIX}${index})`;
      currentIndex = match.endIndex;
    });

  return result + text.slice(currentIndex);
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(MARKDOWN_LABEL_ESCAPE, "\\$&");
}

function transformMarkdownUrl(url: string): string {
  if (url.startsWith(TIMER_HREF_PREFIX) || url.startsWith("norish-ingredient:")) return url;
  if (url.startsWith("/recipes/") || url.startsWith("#")) return url;
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;

  return "";
}
