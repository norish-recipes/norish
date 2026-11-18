import type { HeaderItem } from "@/lib/header-item";
import React, { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

type SfSymbol = Extract<
  NonNullable<Extract<HeaderItem, { type: "button" }>["icon"]>,
  { type: "sfSymbol" }
>["name"];

/** The header's confirm item: a sheet's Save, an editor's Create. Without `onPress` it is disabled. */
export type HeaderConfirm = {
  label: string;
  /** A promise holds the item until it settles, so a second tap cannot start the action twice. */
  onPress?: () => void | Promise<unknown>;
  disabled?: boolean;
  /** A glyph in place of the label, for a label too long for the header; the label stays its
   * accessibility name. */
  symbol?: SfSymbol;
};

/** What a sheet hands `Sheet`: its title, its one confirm and its other header actions. */
export type SheetActions = {
  confirm?: HeaderConfirm;
  secondary?: HeaderAction[];
};

/** A secondary action in the header: a glass item, or a menu entry where there are several. */
export type HeaderAction = {
  label: string;
  symbol: SfSymbol;
  onPress: () => void | Promise<unknown>;
  disabled?: boolean;
  /** In the danger colour, as a button or a menu entry. */
  destructive?: boolean;
  /** Always a menu entry, never a lone glass item: removing data sits one tap from the confirm. */
  inMenu?: boolean;
};

/** The one destructive action: a menu entry for removing data (Delete on a grocery, Remove on a
 * planned item), or with `inMenu: false` a glass item for clearing a setting. */
export const destructiveAction = (
  label: string,
  onPress: HeaderAction["onPress"],
  { inMenu = true }: { inMenu?: boolean } = {}
): HeaderAction => ({ label, symbol: "trash", destructive: true, inMenu, onPress });

/** A sheet's or modal's one native header, rendered inside the screen: the title, a glass Close
 * on the left (Back with `back`, inside a sheet) and, on the right, the secondary actions then the
 * confirm. One secondary action is a glass item; several share one menu. */
export function ModalHeader({
  title,
  back = false,
  onClose,
  confirm,
  secondary = [],
}: {
  title: string;
  /** The left item goes back to the sheet's form instead of closing the sheet. */
  back?: boolean;
  /** Going back by default. */
  onClose?: () => void;
  confirm?: HeaderConfirm;
  secondary?: HeaderAction[];
}) {
  const intl = useIntl();
  const router = useRouter();
  const [danger] = useThemeColor(["danger"] as const);
  // The native item is replaced a moment after a render: it calls this, so a press in that gap still runs the latest handler.
  const latestRef = useRef({ confirm, secondary });
  const busyRef = useRef(false);

  useEffect(() => {
    latestRef.current = { confirm, secondary };
  });

  // A press while the last one's action is still pending or the item is disabled does nothing.
  const run = (action?: { onPress?: HeaderAction["onPress"]; disabled?: boolean }) => {
    if (busyRef.current || action?.disabled) return;
    const result = action?.onPress?.();

    if (result instanceof Promise) {
      busyRef.current = true;
      const release = () => {
        busyRef.current = false;
      };

      result.then(release, release);
    }
  };

  const secondaryItems = (): HeaderItem[] => {
    const icon = ({ symbol }: HeaderAction) => ({ type: "sfSymbol", name: symbol }) as const;
    const press = (index: number) => () => run(latestRef.current.secondary[index]);

    if (secondary.length > 1 || secondary.some((action) => action.inMenu)) {
      const label = intl.formatMessage({ id: "recipes.actions.actionsLabel" });

      return [
        {
          type: "menu",
          label,
          accessibilityLabel: label,
          icon: { type: "sfSymbol", name: "ellipsis" },
          menu: {
            items: secondary.map((action, index) => ({
              type: "action",
              label: action.label,
              icon: icon(action),
              destructive: action.destructive,
              disabled: action.disabled,
              onPress: press(index),
            })),
          },
        },
      ];
    }

    return secondary.map((action, index) => ({
      type: "button",
      label: action.label,
      accessibilityLabel: action.label,
      icon: icon(action),
      tintColor: action.destructive ? danger : undefined,
      disabled: action.disabled,
      onPress: press(index),
    }));
  };

  const leftLabel = intl.formatMessage({
    id: back ? "common.actions.back" : "common.actions.close",
  });

  return (
    <Stack.Screen
      options={{
        title,
        headerBackVisible: false,
        unstable_headerLeftItems: () => [
          {
            type: "button",
            label: leftLabel,
            accessibilityLabel: leftLabel,
            icon: { type: "sfSymbol", name: back ? "chevron.backward" : "xmark" },
            onPress: onClose ?? (() => router.back()),
          },
        ],
        unstable_headerRightItems: () => [
          ...secondaryItems(),
          ...(confirm
            ? ([
                {
                  type: "button",
                  label: confirm.label,
                  accessibilityLabel: confirm.label,
                  icon: confirm.symbol
                    ? ({ type: "sfSymbol", name: confirm.symbol } as const)
                    : undefined,
                  variant: "prominent",
                  disabled: confirm.disabled || !confirm.onPress,
                  // The native item type requires a handler; `disabled` above keeps it from firing.
                  onPress: () => run(latestRef.current.confirm),
                },
              ] as const)
            : []),
        ],
      }}
    />
  );
}
