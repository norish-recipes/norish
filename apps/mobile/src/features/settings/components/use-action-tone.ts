import { useTokenColor } from "@/hooks/use-token-color";
import { useThemeColor } from "heroui-native";

import type { ActionTone } from "../utils/row-actions";

const HEX = /^#[0-9a-f]{6}$/i;
const hexOrUndefined = (colour: string | undefined) =>
  colour && HEX.test(colour) ? colour : undefined;

/** The one place an action's tone becomes colours: the menu icon's `tint` (a `#rrggbb` or unset). */
export function useActionTone() {
  const [foreground, danger, accent, warning] = useThemeColor([
    "foreground",
    "danger",
    "accent",
    "warning",
  ] as const);
  const shop = useTokenColor("shop");

  return (tone: ActionTone) => ({
    destructive: tone === "danger",
    tint: hexOrUndefined(
      { danger, shop: hexOrUndefined(shop) ?? warning, accent, plain: foreground }[tone]
    ),
  });
}
