import React from "react";
import { View } from "react-native";
import { DestructiveMenuButton } from "@/components/destructive-menu-button";
import { Button, Host, Menu } from "@expo/ui/swift-ui";
import { buttonStyle, labelStyle } from "@expo/ui/swift-ui/modifiers";
import { useIntl } from "react-intl";

export type SectionActions = {
  markAllDone?: () => void;
  deleteDone?: () => void;
  clearAll: () => void;
};

/** A section's kebab: Mark all done, Delete done and Clear all, in iOS's own menu. */
export function SectionMenu({
  actions,
  label,
  testID,
}: {
  actions: SectionActions;
  label: string;
  testID: string;
}) {
  const intl = useIntl();
  const text = (id: string) => intl.formatMessage({ id });

  return (
    <View testID={testID}>
      <Host matchContents>
        <Menu
          label={label}
          modifiers={[buttonStyle("plain"), labelStyle("iconOnly")]}
          systemImage="ellipsis"
        >
          {actions.markAllDone ? (
            <Button
              label={text("groceries.store.markAllDone")}
              systemImage="checkmark"
              onPress={actions.markAllDone}
            />
          ) : null}
          {actions.deleteDone ? (
            <DestructiveMenuButton
              label={text("groceries.store.deleteDone")}
              systemImage="trash"
              onPress={actions.deleteDone}
            />
          ) : null}
          <DestructiveMenuButton
            label={text("groceries.store.clearAll")}
            systemImage="trash"
            onPress={actions.clearAll}
          />
        </Menu>
      </Host>
    </View>
  );
}
