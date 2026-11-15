import React from "react";
import { Linking, Text } from "react-native";

import { usePlatform } from "@norish/shared-react/platform";
import { TIMER_HREF_PREFIX } from "@norish/shared/lib/timer-parser";

import type { InlineNode } from "../utils/inline-markdown";
import { linkTarget, parseInline } from "../utils/inline-markdown";

/** A recipe's text with links, bold and italic, nested in a Text; `norish-timer:` links go to `renderTimer`. */
export function InlineMarkdown({
  text,
  disableLinks = false,
  renderTimer,
}: {
  text: string;
  disableLinks?: boolean;
  renderTimer?: (index: number) => React.ReactNode;
}) {
  const { navigation } = usePlatform();

  const render = (nodes: InlineNode[]): React.ReactNode[] =>
    nodes.map((node, index) => {
      // The nodes are positional and rebuilt from the text, so their place is their identity.
      const key = index;

      if (node.kind === "text") return <React.Fragment key={key}>{node.text}</React.Fragment>;

      if (node.kind === "link" && node.href.startsWith(TIMER_HREF_PREFIX)) {
        const timer = renderTimer?.(Number(node.href.slice(TIMER_HREF_PREFIX.length)));

        return <React.Fragment key={key}>{timer ?? render(node.children)}</React.Fragment>;
      }

      if (node.kind === "link") {
        const target = disableLinks ? null : linkTarget(node.href);

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
