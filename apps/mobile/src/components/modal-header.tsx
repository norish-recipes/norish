import React from "react";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

/** The header's confirm item: a sheet's Save, an editor's Create. */
export type HeaderConfirm = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * The one native header of a sheet or modal screen: the system title, a glass Close on the left
 * and, where the screen saves, a prominent confirm item on the right. Render it inside the screen.
 */
export function ModalHeader({
  name,
  title,
  onClose,
  confirm,
}: {
  /** The identifier prefix: `<name>-close` and `<name>-confirm` on the items. */
  name: string;
  title: string;
  onClose: () => void;
  confirm?: HeaderConfirm;
}) {
  const intl = useIntl();
  const closeLabel = intl.formatMessage({ id: "common.actions.close" });

  return (
    <Stack.Screen
      options={{
        title,
        headerBackVisible: false,
        unstable_headerLeftItems: () => [
          {
            type: "button",
            label: closeLabel,
            accessibilityLabel: closeLabel,
            icon: { type: "sfSymbol", name: "xmark" },
            identifier: `${name}-close`,
            onPress: onClose,
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
                  disabled: confirm.disabled,
                  identifier: `${name}-confirm`,
                  onPress: confirm.onPress,
                },
              ]
            : [],
      }}
    />
  );
}
