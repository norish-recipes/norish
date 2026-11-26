"use client";

import type { ReactNode } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ListFrame } from "@/components/shared/list-row";
import { Note } from "@/components/shared/note";
import { Section } from "@/components/shared/section";
import { useTranslations } from "next-intl";

import { NameField } from "./name-field";
import Panel from "./Panel";

/**
 * The panel every list's Add opens: a name, what is offered before the matches (`children`), the
 * entries the name already matches (`matches`), Cancel and Add. Enter adds when Add is on.
 */
export function AddPanel({
  open,
  onOpenChange,
  title,
  name,
  onNameChange,
  canAdd,
  onAdd,
  problem,
  offline,
  matchesTitle,
  matches,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  name: string;
  onNameChange: (name: string) => void;
  canAdd: boolean;
  onAdd: () => void;
  problem: string | null;
  offline: boolean;
  matchesTitle: string;
  /** The rows of the matching entries; none shows no section. */
  matches: ReactNode[];
  children?: ReactNode;
}) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");
  const close = () => onOpenChange(false);

  return (
    <Panel open={open} title={title} onOpenChange={onOpenChange}>
      <Panel.Body sections>
        {problem ? <Note status="warning">{problem}</Note> : null}
        <Section placement="panel" title={t("panel.name")}>
          <NameField
            data-testid="content-add-name"
            value={name}
            onChange={onNameChange}
            onSubmit={() => {
              if (canAdd) onAdd();
            }}
          />
        </Section>
        {children}
        {matches.length > 0 ? (
          <Section placement="panel" title={matchesTitle}>
            <ListFrame>{matches}</ListFrame>
          </Section>
        ) : null}
        {offline ? <Note>{t("offline")}</Note> : null}
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup
          start={
            <ActionButton action="cancel" onPress={close}>
              {tActions("cancel")}
            </ActionButton>
          }
        >
          <ActionButton
            action="add"
            data-testid="content-add-submit"
            isDisabled={!canAdd}
            onPress={onAdd}
          >
            {tActions("add")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
