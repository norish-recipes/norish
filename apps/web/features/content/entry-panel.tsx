"use client";

import { useState } from "react";
import Panel from "@/components/Panel/Panel";
import { PanelSection } from "@/components/Panel/panel-section";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { Note } from "@/components/shared/note";
import { ArrowRightIcon } from "@heroicons/react/16/solid";
import { Chip, Input, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerKind } from "@norish/shared-react/lists";
import { useContentEntry } from "@norish/shared-react/lists";

/**
 * One entry of a list. Editable: rename it, or merge it onto the entry its new name folds onto,
 * or delete it. Read only (the server's entries for a member, the built-in Categories for all):
 * its name and use, and Done.
 */
export function EntryPanel({
  id,
  kind,
  open,
  onOpenChange,
}: {
  id: string;
  kind: PickerKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");
  const tCommon = useTranslations("common");
  const entry = useContentEntry(kind, id);
  const [confirming, setConfirming] = useState(false);
  const { view } = entry;
  const editable = entry.access === "edit";
  const server = entry.entry?.instance === true;
  const close = () => onOpenChange(false);
  let problem: string | null = null;

  if (entry.problem === "stale") problem = tCommon("changedElsewhere.title");
  else if (entry.problem === "tooLong") problem = t("panel.tooLong", { max: view?.max ?? 0 });
  else if (entry.problem === "failed") problem = t("panel.failed");

  let note: string | null = null;

  if (entry.access === "fixed") note = t("help.builtIn");
  else if (entry.access === "readOnly") note = t("panel.serverReadOnly");
  else if (editable && server) note = t("panel.serverEditable");

  const save = async () => {
    if (await entry.save()) close();
  };
  const remove = async () => {
    if (await entry.remove()) {
      setConfirming(false);
      close();
    }
  };

  return (
    <>
      <Panel
        open={open && !entry.gone}
        title={editable ? t(`panel.editTitle.${kind}`) : (entry.entry?.name ?? "")}
        titleAddon={server ? <Chip size="sm">{t("panel.server")}</Chip> : undefined}
        onOpenChange={onOpenChange}
      >
        <Panel.Body>
          <div className="flex flex-col gap-5">
            {note ? <Note>{note}</Note> : null}
            {problem ? <Note status="warning">{problem}</Note> : null}
            <PanelSection title={t("panel.name")}>
              <TextField
                aria-label={t("panel.name")}
                isReadOnly={!editable}
                value={entry.name}
                onChange={entry.setName}
              >
                <Input
                  data-testid="content-entry-name"
                  variant="secondary"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (entry.canSave) void save();
                    }
                  }}
                />
              </TextField>
              {view?.target ? (
                <Note status="accent">
                  {t("panel.merge", {
                    target: view.target.name,
                    name: entry.entry?.name ?? "",
                    count: view.moved,
                  })}
                </Note>
              ) : null}
            </PanelSection>
            <PanelSection title={t("panel.usedBy")}>
              <p className="text-base" data-testid="content-entry-used">
                {t(editable && server ? "panel.usedByOwn" : "recipes", {
                  count: entry.entry?.recipeCount ?? 0,
                })}
              </p>
            </PanelSection>
            {editable && entry.offline ? <Note>{t("offline")}</Note> : null}
          </div>
        </Panel.Body>
        <Panel.Footer>
          {editable ? (
            <ActionButtonGroup
              start={
                <ActionButton
                  action="delete"
                  data-testid="content-delete"
                  isDisabled={entry.offline}
                  onPress={() => setConfirming(true)}
                >
                  {tActions("delete")}
                </ActionButton>
              }
            >
              <ActionButton
                action="save"
                data-testid="content-save"
                icon={view?.action === "merge" ? ArrowRightIcon : undefined}
                isDisabled={!entry.canSave}
                onPress={() => void save()}
              >
                {view?.action === "merge" ? t("panel.mergeAction") : tActions("save")}
              </ActionButton>
            </ActionButtonGroup>
          ) : (
            <ActionButtonGroup>
              <ActionButton action="done" onPress={close}>
                {tActions("done")}
              </ActionButton>
            </ActionButtonGroup>
          )}
        </Panel.Footer>
      </Panel>
      <ConfirmModal
        confirm={
          <ActionButton
            action="delete"
            data-testid="content-delete-confirm"
            isDisabled={entry.deleteImpact === null || entry.pending || entry.offline}
            variant="danger"
            onPress={() => void remove()}
          >
            {tActions("delete")}
          </ActionButton>
        }
        danger
        data-testid="content-delete-modal"
        isOpen={confirming}
        title={t("delete.title", { name: entry.entry?.name ?? "" })}
        onOpenChange={setConfirming}
      >
        {entry.deleteImpact ? (
          <p>
            {t(entry.deleteImpact.scope === "server" ? "delete.bodyServer" : "delete.body", {
              count: entry.deleteImpact.recipes,
            })}
          </p>
        ) : null}
      </ConfirmModal>
    </>
  );
}
