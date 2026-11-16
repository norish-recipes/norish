import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { ModalHeader } from "@/components/modal-header";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { RecipeEditorMode } from "@norish/shared-react/recipes";

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
  const router = useRouter();
  const create = mode === "create";
  const text = (id: string) => intl.formatMessage({ id });

  return (
    <View className="bg-background flex-1" testID={testID}>
      <ModalHeader
        confirm={
          onSave
            ? {
                label: text(create ? "common.actions.create" : "common.actions.save"),
                disabled: saving,
                onPress: onSave,
              }
            : undefined
        }
        title={text(create ? "recipes.editor.newTitle" : "recipes.editor.editTitle")}
        onClose={() => router.back()}
      />
      {children}
    </View>
  );
}
