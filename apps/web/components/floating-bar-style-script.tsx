import { FLOATING_BAR_ATTRIBUTE } from "@/lib/floating-bar-style";

import type { FloatingBarStyle } from "@norish/shared/contracts/zod/device-preferences";

/**
 * Server-rendered ahead of the page, so the attribute is on <html> before the first frame that
 * holds a floating bar paints. Nothing is rendered for `contrast`, the default.
 */
export function FloatingBarStyleScript({ style }: { style: FloatingBarStyle }) {
  if (style !== "match") return null;

  return (
    <script
      // A constant, and React escapes a script's text children, so it goes in as raw HTML.
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.setAttribute("${FLOATING_BAR_ATTRIBUTE}", "match");`,
      }}
    />
  );
}
