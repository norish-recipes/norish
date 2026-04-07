import type { BlockToken, InlineToken } from "./types";

// ─── Block parsing ───────────────────────────────────────────────────────────

/**
 * Parse markdown-like text into block tokens (headings + paragraphs).
 */
export function parseBlocks(text: string): BlockToken[] {
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: BlockToken[] = [];
  let currentLines: string[] = [];

  const flushParagraph = () => {
    if (currentLines.length > 0) {
      const joined = currentLines.join("\n");
      blocks.push({ type: "paragraph", children: parseInline(joined) });
      currentLines = [];
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingMatch[1]!.length,
        children: parseInline(headingMatch[2]!),
      });
    } else {
      currentLines.push(line);
    }
  }

  flushParagraph();
  return blocks;
}

// ─── Inline parsing ──────────────────────────────────────────────────────────

/**
 * Parse inline formatting: bold, italic, bold-italic, and links.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];

  // Regex matches bold-italic (***), bold (**), italic (*), and links [text](url)
  const regex =
    /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_([^_]+?)_|\[([^\]]+)\]\(([^)]+)\)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1] != null) {
      tokens.push({ type: "bold-italic", content: match[1] });
    } else if (match[2] != null) {
      tokens.push({ type: "bold", content: match[2] });
    } else if (match[3] != null) {
      tokens.push({ type: "bold", content: match[3] });
    } else if (match[4] != null) {
      tokens.push({ type: "italic", content: match[4] });
    } else if (match[5] != null) {
      tokens.push({ type: "italic", content: match[5] });
    } else if (match[6] != null && match[7] != null) {
      tokens.push({ type: "link", label: match[6], href: match[7] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  return tokens;
}

// ─── Markdown stripping for timer detection ──────────────────────────────────

export type StrippedText = {
  /** Plain text with markdown formatting removed */
  plain: string;
  /**
   * Maps each index in `plain` back to the corresponding index in the
   * original text. Has length `plain.length + 1` (the extra entry maps
   * the "end" position).
   */
  toOriginal: number[];
};

/**
 * Strip inline markdown formatting (bold, italic, links) from text while
 * building a position map from stripped→original indices.
 *
 * This lets `parseTimerDurations` operate on clean text (so `**5 minutes**`
 * is detected as `5 minutes`), and we can map positions back to the original
 * text to correctly split around timers.
 */
export function stripMarkdownForTimerDetection(text: string): StrippedText {
  // Regex that matches markdown delimiters we want to strip:
  //   ***...***, **...**, __...__, *...*, _..._, [label](url)
  const mdRegex =
    /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_([^_]+?)_|\[([^\]]+)\]\(([^)]+)\)/g;

  const plainChars: string[] = [];
  const toOriginal: number[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mdRegex.exec(text)) !== null) {
    // Copy verbatim text before this match
    for (let i = lastIndex; i < match.index; i++) {
      toOriginal.push(i);
      plainChars.push(text[i]!);
    }

    // Determine the inner content and where it sits in the original
    let innerContent: string;
    let innerStart: number;

    if (match[1] != null) {
      // ***bold-italic***  — inner starts after ***
      innerContent = match[1];
      innerStart = match.index + 3;
    } else if (match[2] != null) {
      // **bold**  — inner starts after **
      innerContent = match[2];
      innerStart = match.index + 2;
    } else if (match[3] != null) {
      // __bold__  — inner starts after __
      innerContent = match[3];
      innerStart = match.index + 2;
    } else if (match[4] != null) {
      // *italic*  — inner starts after *
      innerContent = match[4];
      innerStart = match.index + 1;
    } else if (match[5] != null) {
      // _italic_  — inner starts after _
      innerContent = match[5];
      innerStart = match.index + 1;
    } else if (match[6] != null) {
      // [label](url)  — keep only the label
      innerContent = match[6];
      innerStart = match.index + 1; // after [
    } else {
      // Shouldn't happen, but keep the full match as-is
      innerContent = match[0];
      innerStart = match.index;
    }

    // Map inner content characters to their original positions
    for (let i = 0; i < innerContent.length; i++) {
      toOriginal.push(innerStart + i);
      plainChars.push(innerContent[i]!);
    }

    lastIndex = match.index + match[0].length;
  }

  // Copy remaining text after last match
  for (let i = lastIndex; i < text.length; i++) {
    toOriginal.push(i);
    plainChars.push(text[i]!);
  }

  // Extra entry for the "end" position
  toOriginal.push(text.length);

  return {
    plain: plainChars.join(""),
    toOriginal,
  };
}
