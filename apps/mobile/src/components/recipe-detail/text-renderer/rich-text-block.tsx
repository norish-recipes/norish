import type { StyleProp, TextProps, TextStyle } from "react-native";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { useThemeColor } from "heroui-native";

import { InlineTokenRenderer } from "./inline-token-renderer";
import { parseBlocks } from "./parse-blocks";

// ─── Props ───────────────────────────────────────────────────────────────────

type RichTextBlockProps = {
  /** Raw text with markdown-like formatting */
  text: string;
  /** Base text style */
  style?: StyleProp<TextStyle>;
  /** Whether links should be disabled */
  disableLinks?: boolean;
  /**
   * If true, renders the parsed tokens as a fragment (no wrapping <Text>)
   * so they can be composed inside a parent <Text> tree.
   */
  asFragment?: boolean;
  /** Extra props forwarded to the root <Text> (only when asFragment is false) */
  textProps?: TextProps;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders a chunk of markdown-like text as React Native <Text> nodes.
 * Handles headings, bold, italic, links, etc.
 *
 * When `asFragment` is true, returns inline tokens without a wrapping
 * <Text> element — suitable for composing inside a parent <Text> tree
 * (e.g. when mixing text with inline timer badges).
 */
export function RichTextBlock({
  text,
  style,
  disableLinks = false,
  asFragment = false,
  textProps,
}: RichTextBlockProps) {
  const [foregroundColor] = useThemeColor(["foreground"] as const);
  const flatStyle = StyleSheet.flatten(style);

  const blocks = parseBlocks(text);

  const baseColor = (flatStyle?.color as string) ?? foregroundColor;

  const content = blocks.map((block, bi) => {
    if (block.type === "heading") {
      return (
        <Text
          key={bi}
          className="mt-1 text-[17px] leading-6 font-bold"
          style={{ color: foregroundColor }}
        >
          <InlineTokenRenderer
            tokens={block.children}
            baseStyle={{ color: foregroundColor }}
            disableLinks={disableLinks}
          />
          {"\n"}
        </Text>
      );
    }

    return (
      <Text key={bi}>
        <InlineTokenRenderer
          tokens={block.children}
          baseStyle={{ color: baseColor }}
          disableLinks={disableLinks}
        />
      </Text>
    );
  });

  if (asFragment) {
    return <>{content}</>;
  }

  return (
    <Text style={style} {...textProps}>
      {content}
    </Text>
  );
}
