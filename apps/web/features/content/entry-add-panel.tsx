"use client";

import Panel from "@/components/Panel/Panel";
import { PanelSection } from "@/components/Panel/panel-section";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Input, Radio, RadioGroup, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerKind } from "@norish/shared-react/lists";
import { useContentAdd } from "@norish/shared-react/lists";

/** At most this many of the entries a name already matches are listed. */
const MATCH_LIMIT = 5;

/**
 * Add to a list: the entries the name already matches are listed as you type, and Add is there only
 * when none folds alike. A name the server finds already there opens that entry instead.
 */
export function EntryAddPanel({
  kind,
  open,
  onOpenChange,
  onOpenEntry,
}: {
  kind: PickerKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenEntry: (id: string) => void;
}) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");
  const add = useContentAdd(kind);
  const close = () => onOpenChange(false);
  const typed = add.typed.trim() !== "";
  let problem: string | null = null;

  if (add.problem === "loadFailed") problem = t("loadFailed");
  else if (add.problem === "tooLong") problem = t("panel.tooLong", { max: add.max ?? 0 });
  else if (add.problem === "failed") problem = t("panel.failed");

  const submit = async () => {
    const added = await add.add();

    if (!added) return;
    if (added.created) close();
    else onOpenEntry(added.entry.id);
  };

  return (
    <Panel open={open} title={t(`panel.addTitle.${kind}`)} onOpenChange={onOpenChange}>
      <Panel.Body>
        <div className="flex flex-col gap-5">
          {problem ? <Note status="warning">{problem}</Note> : null}
          <PanelSection title={t("panel.name")}>
            <TextField aria-label={t("panel.name")} value={add.typed} onChange={add.setTyped}>
              <Input
                data-testid="content-add-name"
                variant="secondary"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (add.canAdd) void submit();
                  }
                }}
              />
            </TextField>
          </PanelSection>
          {add.canAddForServer ? (
            <PanelSection title={t("panel.addTo")}>
              <RadioGroup
                aria-label={t("panel.addTo")}
                value={add.forServer ? "server" : "household"}
                onChange={(value) => add.setForServer(value === "server")}
              >
                <Radio value="household">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Radio.Content>{t("panel.toHousehold")}</Radio.Content>
                </Radio>
                <Radio value="server">
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Radio.Content>{t("panel.toServer")}</Radio.Content>
                </Radio>
              </RadioGroup>
            </PanelSection>
          ) : null}
          {typed && add.matches.length > 0 ? (
            <PanelSection title={t(`panel.already.${kind}`)}>
              <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
                {add.matches.slice(0, MATCH_LIMIT).map((match) => (
                  <li key={match.id}>
                    <button
                      className="hover:bg-default/40 focus-visible:ring-focus flex min-h-12 w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-4 text-start focus-visible:ring-2 focus-visible:outline-none"
                      data-testid="content-add-match"
                      type="button"
                      onClick={() => onOpenEntry(match.id)}
                    >
                      <span className="min-w-0 flex-1 truncate">{match.name}</span>
                      <span className="text-muted text-sm tabular-nums">
                        {t("recipes", { count: match.recipeCount })}
                      </span>
                      <ChevronRightIcon aria-hidden className="text-muted size-4 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </PanelSection>
          ) : null}
          {add.offline ? <Note>{t("offline")}</Note> : null}
        </div>
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
            isDisabled={!add.canAdd}
            onPress={() => void submit()}
          >
            {tActions("add")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
