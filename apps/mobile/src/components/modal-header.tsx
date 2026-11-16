import React from "react";
import { Stack, useRouter } from "expo-router";
import { useIntl } from "react-intl";

/** The header's confirm item: a sheet's Save, an editor's Create. Without `onPress` it is disabled. */
export type HeaderConfirm = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * The one native header of a sheet or modal screen: the system title, a glass Close on the left
 * (a Back chevron with `back`, for a step inside a sheet) and, where the screen saves, a
 * prominent confirm item on the right. Render it inside the screen.
 */
export function ModalHeader({
  title,
  back = false,
  onClose,
  confirm,
}: {
  title: string;
  /** The left item goes back to the sheet's form instead of closing the sheet. */
  back?: boolean;
  /** Going back by default. */
  onClose?: () => void;
  confirm?: HeaderConfirm;
}) {
  const intl = useIntl();
  const router = useRouter();
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
        unstable_headerRightItems: () =>
          confirm
            ? [
                {
                  type: "button",
                  label: confirm.label,
                  accessibilityLabel: confirm.label,
                  variant: "prominent",
                  disabled: confirm.disabled || !confirm.onPress,
                  // The native item type requires a handler; `disabled` above keeps it from firing.
                  onPress: confirm.onPress ?? (() => {}),
                },
              ]
            : [],
      }}
    />
  );
}
