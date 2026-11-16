import React from "react";
import { ModalHeader } from "@/components/modal-header";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

/** The editor's native header in every state: Close, and Save or Create once there is a form. */
export function EditorHeader({
  mode,
  onSave,
  saving = false,
}: {
  mode: "create" | "edit";
  /** Absent while the recipe loads or is gone, which shows no confirm item. */
  onSave?: () => void;
  saving?: boolean;
}) {
  const intl = useIntl();
  const router = useRouter();
  const text = (id: string) => intl.formatMessage({ id });

  return (
    <ModalHeader
      confirm={
        onSave
          ? {
              label: text(mode === "create" ? "common.actions.create" : "common.actions.save"),
              disabled: saving,
              onPress: onSave,
            }
          : undefined
      }
      name="recipe-editor"
      title={text(mode === "create" ? "recipes.editor.newTitle" : "recipes.editor.editTitle")}
      onClose={() => router.back()}
    />
  );
}
