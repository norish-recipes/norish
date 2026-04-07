import type { TextStyle } from "react-native";
import React from "react";
import { Linking, Text } from "react-native";
import { useThemeColor } from "heroui-native";

import type { InlineToken } from "./types";

// ─── Props ───────────────────────────────────────────────────────────────────

type InlineTokenRendererProps = {
  tokens: InlineToken[];
  baseStyle: TextStyle;
  disableLinks?: boolean;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders an array of InlineTokens as React Native <Text> nodes.
 */
export function InlineTokenRenderer({
  tokens,
  baseStyle,
  disableLinks = false,
}: InlineTokenRendererProps) {
  const [foregroundColor, linkColor] = useThemeColor(["foreground", "link"] as const);

  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case "bold":
            return (
              <Text key={i} style={[baseStyle, { fontWeight: "700", color: foregroundColor }]}>
                {token.content}
              </Text>
            );
          case "italic":
            return (
              <Text key={i} style={[baseStyle, { fontStyle: "italic" }]}>
                {token.content}
              </Text>
            );
          case "bold-italic":
            return (
              <Text
                key={i}
                style={[
                  baseStyle,
                  { fontWeight: "700", fontStyle: "italic", color: foregroundColor },
                ]}
              >
                {token.content}
              </Text>
            );
          case "link": {
            const href = token.href.startsWith("id:")
              ? `/recipes/${token.href.slice(3)}`
              : token.href;

            if (disableLinks) {
              return (
                <Text key={i} className="underline" style={[baseStyle, { color: foregroundColor }]}>
                  {token.label}
                </Text>
              );
            }

            return (
              <Text
                key={i}
                className="underline"
                style={[baseStyle, { color: linkColor }]}
                onPress={() => {
                  if (href.startsWith("http")) {
                    Linking.openURL(href);
                  }
                }}
              >
                {token.label}
              </Text>
            );
          }
          case "text":
          default:
            return (
              <Text key={i} style={baseStyle}>
                {token.content}
              </Text>
            );
        }
      })}
    </>
  );
}
