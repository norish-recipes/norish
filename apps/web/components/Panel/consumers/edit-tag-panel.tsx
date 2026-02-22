"use client";

import { useState, useEffect, useMemo } from "react";
import { Button, Input } from "@heroui/react";
import { useTranslations } from "next-intl";

import Panel, { PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";

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
    <Panel
      height={PANEL_HEIGHT_COMPACT}
      open={open}
      title={t("editTitle")}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="space-y-3">
            <Input
              classNames={{
                input: "text-lg font-medium",
                inputWrapper: "border-primary-200 dark:border-primary-800",
              }}
              errorMessage={isDuplicate ? t("duplicateTag") : undefined}
              isInvalid={isDuplicate}
              placeholder={t("editPlaceholder")}
              size="lg"
              style={{ fontSize: "16px" }}
              value={tagName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onValueChange={setTagName}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              className="min-w-16"
              color="danger"
              size="sm"
              variant="flat"
              onPress={handleDelete}
            >
              {tActions("delete")}
            </Button>
            <Button
              className="min-w-16"
              color="primary"
              isDisabled={!canSave}
              size="sm"
              onPress={handleSubmit}
            >
              {tActions("save")}
            </Button>
          </div>
        </form>
      </div>
    </Panel>
  );
}
