import type { AccessibilityActionEvent } from "react-native";
import { useIntl } from "react-intl";

import type { MenuItem } from "../components/card-menu";
import type { ActionDefinition } from "../utils/card-actions";

/** A card's long-press menu items plus the VoiceOver actions that mirror them. */
export function useCardActionMenu<Key extends string>(
  keys: readonly Key[],
  definitions: (key: Key) => ActionDefinition,
  handlers: Record<Key, () => void>
) {
  const intl = useIntl();
  const items: MenuItem[] = keys.map((key) => {
    const { labelId, icon, destructive } = definitions(key);

    return {
      key,
      label: intl.formatMessage({ id: labelId }),
      icon,
      destructive,
      onPress: handlers[key],
    };
  });

  return {
    items,
    accessibilityProps: {
      accessibilityActions: items.map(({ key, label }) => ({ name: key, label })),
      onAccessibilityAction: ({ nativeEvent }: AccessibilityActionEvent) => {
        const key = keys.find((candidate) => candidate === nativeEvent.actionName);

        if (key) handlers[key]();
      },
    },
  };
}
