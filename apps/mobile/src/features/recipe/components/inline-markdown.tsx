import React from "react";
import { Linking, Text } from "react-native";

import { usePlatform } from "@norish/shared-react/platform";

import type { InlineNode } from "../utils/inline-markdown";
import { linkTarget, parseInline } from "../utils/inline-markdown";

/** A recipe's text with its links, bold and italic; nest it in a Text, which sets the type. */
export function InlineMarkdown({ text }: { text: string }) {
  const { navigation } = usePlatform();

  const render = (nodes: InlineNode[]): React.ReactNode[] =>
    nodes.map((node, index) => {
      // The nodes are positional and rebuilt from the text, so their place is their identity.
      const key = index;

      if (node.kind === "text") return <React.Fragment key={key}>{node.text}</React.Fragment>;

      if (node.kind === "link") {
        const target = linkTarget(node.href);

        return target ? (
          <Text
            key={key}
            accessibilityRole="link"
            className="text-accent-text underline"
            onPress={() =>
              target.to === "web"
                ? void Linking.openURL(target.url)
                : navigation.toRecipe(target.id)
            }
          >
            {render(node.children)}
          </Text>
        ) : (
          <React.Fragment key={key}>{render(node.children)}</React.Fragment>
        );
      }

      return (
        <Text key={key} className={node.kind === "bold" ? "font-semibold" : "italic"}>
          {render(node.children)}
        </Text>
      );
    });

  return <>{render(parseInline(text))}</>;
}
