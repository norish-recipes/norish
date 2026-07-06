"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { FieldError, Input, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

type EditTagPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: string;
  existingTags: string[];
  onSave: (newName: string) => void;
  onDelete: () => void;
};
export default function EditTagPanel({
  open,
  onOpenChange,
  tag,
  existingTags,
  onSave,
  onDelete,
}: EditTagPanelProps) {
  const t = useTranslations("recipes.tags.panel");
  const tActions = useTranslations("common.actions");
  const [tagName, setTagName] = useState("");

  // Initialize form with tag data when opening
  useEffect(() => {
    if (open) {
      setTagName(tag);
    } else {
      setTagName("");
    }
  }, [open, tag]);

  // Check if the new name conflicts with an existing tag (case-insensitive)
  // Exclude the current tag being edited from the check
  const isDuplicate = useMemo(() => {
    const trimmed = tagName.trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed === tag.toLowerCase()) return false; // Same as original is OK

    return existingTags.some(
      (t) => t.toLowerCase() === trimmed && t.toLowerCase() !== tag.toLowerCase()
    );
  }, [tagName, tag, existingTags]);
  const canSave = tagName.trim().length > 0 && !isDuplicate;
  const handleSubmit = () => {
    if (!canSave) return;
    onSave(tagName.trim());
    onOpenChange(false);
  };
  const handleDelete = () => {
    onDelete();
    onOpenChange(false);
  };
  return (
    <Panel open={open} title={t("editTitle")} onOpenChange={onOpenChange}>
      <Panel.Body>
        <div className="space-y-3">
          <TextField isInvalid={isDuplicate} value={tagName} onChange={setTagName}>
            <Input
              className="h-12 text-base font-medium"
              variant="secondary"
              placeholder={t("editPlaceholder")}
              style={{
                fontSize: "16px",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {isDuplicate && <FieldError>{t("duplicateTag")}</FieldError>}
          </TextField>
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="delete" onPress={handleDelete}>
            {tActions("delete")}
          </ActionButton>
          <ActionButton action="save" isDisabled={!canSave} onPress={handleSubmit}>
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
