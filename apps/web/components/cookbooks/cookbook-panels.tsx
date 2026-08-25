"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Button, Input, Label, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

/** Ask for a title, and nothing else. Used to create and to rename. */
export function CookbookTitlePanel({
  open,
  onOpenChange,
  mode,
  initialTitle = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "rename";
  initialTitle?: string;
  onSubmit: (title: string) => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const trimmed = title.trim();
  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Panel
      open={open}
      title={mode === "create" ? t("createTitle") : t("renameTitle")}
      onOpenChange={onOpenChange}
    >
      {open ? (
        <Panel.Body>
          <Label className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("titleLabel")}
          </Label>
          <Input
            fullWidth
            data-testid="cookbook-title-input"
            placeholder={t("titlePlaceholder")}
            style={{ fontSize: "16px" }}
            value={title}
            variant="secondary"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton
              action={mode === "create" ? "create" : "save"}
              isDisabled={trimmed.length === 0}
              onPress={submit}
            >
              {mode === "create" ? tActions("create") : tActions("save")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}

/**
 * Delete confirmed by name, following the recipe delete modal — and saying
 * out loud that the recipes it holds are not going anywhere.
 */
export function DeleteCookbookModal({
  isOpen,
  title,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("recipes.cookbooks");
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.Header className="text-danger">{t("deleteTitle")}</Modal.Header>
              <Modal.Body>
                <p>{t("deleteConfirm", { title })}</p>
                <p className="text-muted mt-2">{t("deleteKeepsRecipes")}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={close}>
                  {tActions("cancel")}
                </Button>
                <Button data-testid="confirm-delete-cookbook" variant="danger" onPress={onConfirm}>
                  {tActions("delete")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
