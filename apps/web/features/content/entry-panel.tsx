"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { NameField } from "@/components/Panel/name-field";
import Panel from "@/components/Panel/Panel";
import { SkeletonRows } from "@/components/settings/settings-skeleton";
import { ActionButton, ActionButtonGroup, ArrowEnd } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { ListFrame, ListRow } from "@/components/shared/list-row";
import { Note } from "@/components/shared/note";
import { Section } from "@/components/shared/section";
import { Button, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerKind } from "@norish/shared-react/lists";
import { problemCopy, useContentEntry } from "@norish/shared-react/lists";

import { EntryUsesPanel } from "./entry-uses-panel";

/** One entry of a list: rename it, merge it onto the entry its new name folds onto, delete it, or read it. */
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
  const entry = useContentEntry(kind, id);
  const [confirming, setConfirming] = useState(false);
  const [showingUses, setShowingUses] = useState(false);
  const { view, detail } = entry;
  const editable = detail?.access === "edit";
  const close = () => onOpenChange(false);
  const problem = problemCopy(entry.problem, view?.max);
  const deleteProblem = problemCopy(entry.deleteProblem);
  const save = async () => {
    if (await entry.save()) close();
  };
  const remove = async () => {
    if (await entry.remove()) {
      setConfirming(false);
      close();
    }
  };
  const deleteAction = (
    <ActionButton
      action="delete"
      data-testid="content-delete-confirm"
      isDisabled={entry.deleteState === "counting" || entry.pending || entry.offline}
      variant="danger"
      onPress={() => void remove()}
    >
      {tActions("delete")}
    </ActionButton>
  );
  let confirmAction = deleteAction;
  let confirmBody: ReactNode = null;

  if (entry.deleteState === "stale") {
    // The lists were read again when the delete came back stale, so closing shows what is there now.
    confirmAction = (
      <ActionButton
        action="done"
        onPress={() => {
          setConfirming(false);
          close();
        }}
      >
        {tActions("done")}
      </ActionButton>
    );
  } else if (entry.deleteState === "countFailed") {
    confirmAction = <Button onPress={entry.retryCount}>{tActions("retry")}</Button>;
  }

  if (deleteProblem) confirmBody = <p>{t(deleteProblem.key, deleteProblem.values)}</p>;
  else if (entry.deleteState === "countFailed") confirmBody = <p>{t("delete.countFailed")}</p>;
  else if (entry.deleteState === "counting") confirmBody = <SkeletonRows count={1} />;
  else if (entry.deleteImpact) {
    confirmBody = (
      <p>
        {t(entry.deleteImpact.scope === "server" ? "delete.bodyServer" : "delete.body", {
          count: entry.deleteImpact.recipes,
        })}
      </p>
    );
  }

  return (
    <>
      <Panel
        open={open && !entry.gone}
        title={editable ? t(`panel.editTitle.${kind}`) : (entry.entry?.name ?? "")}
        titleAddon={detail?.badge ? <Chip size="sm">{t("panel.server")}</Chip> : undefined}
        onOpenChange={onOpenChange}
      >
        <Panel.Body sections>
          {detail?.note ? <Note locked={detail.note.locked}>{t(detail.note.key)}</Note> : null}
          {problem ? <Note status="warning">{t(problem.key, problem.values)}</Note> : null}
          <Section placement="panel" title={t("panel.name")}>
            <NameField
              data-testid="content-entry-name"
              readOnly={!editable}
              value={entry.name}
              onChange={entry.setName}
              onSubmit={() => {
                if (entry.canSave) void save();
              }}
            />
            {view?.target ? (
              <Note status="accent">
                {t("panel.merge", {
                  target: view.target.name,
                  name: entry.entry?.name ?? "",
                  count: view.moved,
                })}
              </Note>
            ) : null}
          </Section>
          <Section placement="panel" title={t("panel.usedBy")}>
            <ListFrame>
              <ListRow
                chevron
                data-testid="content-entry-used"
                name={t(detail?.usedKey ?? "recipes", { count: entry.entry?.recipeCount ?? 0 })}
                onPress={() => setShowingUses(true)}
              />
            </ListFrame>
          </Section>
          {editable && entry.offline ? <Note>{t("offline")}</Note> : null}
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
                icon={view?.action === "merge" ? ArrowEnd : undefined}
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
      <EntryUsesPanel
        id={id}
        kind={kind}
        open={showingUses}
        onClose={() => setShowingUses(false)}
      />
      <ConfirmModal
        confirm={confirmAction}
        danger
        data-testid="content-delete-modal"
        isOpen={confirming}
        title={t("delete.title", { name: entry.entry?.name ?? "" })}
        onOpenChange={setConfirming}
      >
        {confirmBody}
      </ConfirmModal>
    </>
  );
}
