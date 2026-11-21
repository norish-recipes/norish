import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { View } from "react-native";
import { ModalHeader } from "@/components/modal-header";
import { useIntl } from "react-intl";

import type { RecipeEditorMode } from "@norish/shared-react/recipes";

import { clearChoice } from "./choice-request";

/** The editor's ground and its native header, the one place the header is declared: it shows in
 * every state, with Save or Create once there is a form (`onSave`). */
export function EditorFrame({
  mode,
  onSave,
  saving = false,
  testID,
  children,
}: {
  mode: RecipeEditorMode;
  onSave?: () => void;
  saving?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const intl = useIntl();
  const create = mode === "create";

  // A choice the editor asked for and no sheet took does not outlive the editor.
  useEffect(() => clearChoice, []);

  return (
    <View className="bg-background flex-1" testID={testID}>
      <ModalHeader
        confirm={
          onSave
            ? {
                label: intl.formatMessage({
                  id: create ? "common.actions.create" : "common.actions.save",
                }),
                disabled: saving,
                onPress: onSave,
              }
            : undefined
        }
        title={intl.formatMessage({
          id: create ? "recipes.editor.newTitle" : "recipes.editor.editTitle",
        })}
      />
      {children}
    </View>
  );
}
