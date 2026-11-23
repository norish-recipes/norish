import { useTokenColor } from "@/hooks/use-token-color";
import { useThemeColor } from "heroui-native";

import type { ActionTone } from "../utils/row-actions";

const HEX = /^#[0-9a-f]{6}$/i;
const hexOrUndefined = (colour: string | undefined) =>
  colour && HEX.test(colour) ? colour : undefined;

const GROUND: Record<ActionTone, string> = {
  danger: "bg-danger",
  shop: "bg-shop",
  accent: "bg-accent",
  plain: "bg-default",
};

/** The one place an action's tone becomes colours: the swipe circle's `ground` class and `ink`, and
 * the menu icon's `tint` (a `#rrggbb` or unset). */
export function useActionTone() {
  const [foreground, danger, dangerInk, accent, accentInk, warning] = useThemeColor([
    "foreground",
    "danger",
    "danger-foreground",
    "accent",
    "accent-foreground",
    "warning",
  ] as const);
  const shop = useTokenColor("shop");
  const shopInk = useTokenColor("shop-foreground");

  return (tone: ActionTone) => ({
    ground: GROUND[tone],
    destructive: tone === "danger",
    ink: { danger: dangerInk, shop: shopInk ?? dangerInk, accent: accentInk, plain: foreground }[
      tone
    ],
    tint: hexOrUndefined(
      { danger, shop: hexOrUndefined(shop) ?? warning, accent, plain: foreground }[tone]
    ),
  });
}
