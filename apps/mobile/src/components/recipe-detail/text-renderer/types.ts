import type { StyleProp, TextProps, TextStyle } from "react-native";

// ─── Inline token types ──────────────────────────────────────────────────────

export type InlineToken =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "bold-italic"; content: string }
  | { type: "link"; label: string; href: string };

// ─── Block token types ───────────────────────────────────────────────────────

export type BlockToken =
  | { type: "heading"; level: number; children: InlineToken[] }
  | { type: "paragraph"; children: InlineToken[] };

// ─── Timer segment types ─────────────────────────────────────────────────────

export type TimerSegment = {
  type: "timer";
  originalText: string;
  durationMs: number;
  timerId: string;
  label: string;
};

export type RichTextSegment = {
  type: "richtext";
  content: string;
};

export type TopSegment = RichTextSegment | TimerSegment;

// ─── SmartText props ─────────────────────────────────────────────────────────

export type SmartTextProps = {
  /** The raw text with markdown-like formatting */
  children: string;
  /** Base text style to apply */
  style?: StyleProp<TextStyle>;
  /** If true, links are rendered as styled text but are not tappable */
  disableLinks?: boolean;
  /** If true, detect and highlight timer patterns (e.g. "15 minutes") */
  highlightTimers?: boolean;
  /**
   * Recipe context for timer IDs. Required when highlightTimers is true
   * to generate unique timer identifiers.
   */
  timerContext?: {
    recipeId: string;
    recipeName?: string;
    stepIndex: number;
  };
  /** Extra props forwarded to the root <Text> (only when no timers present) */
  textProps?: TextProps;
};
