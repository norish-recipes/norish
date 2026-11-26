"use client";

import { AddPanel } from "@/components/Panel/add-panel";
import { ListRow } from "@/components/shared/list-row";
import { Section } from "@/components/shared/section";
import { Radio, RadioGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerKind } from "@norish/shared-react/lists";
import { problemCopy, useContentAdd } from "@norish/shared-react/lists";

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
  const add = useContentAdd(kind);
  const copy = problemCopy(add.problem, add.max);
  const submit = async () => {
    const added = await add.add();

    if (!added) return;
    if (added.created) onOpenChange(false);
    else onOpenEntry(added.entry.id);
  };

  return (
    <AddPanel
      canAdd={add.canAdd}
      matches={
        add.typed.trim() === ""
          ? []
          : add.matches.map((match) => (
              <ListRow
                key={match.id}
                chevron
                count={t("recipes", { count: match.recipeCount })}
                data-testid="content-add-match"
                name={match.name}
                onPress={() => onOpenEntry(match.id)}
              />
            ))
      }
      matchesTitle={t(`panel.already.${kind}`)}
      name={add.typed}
      offline={add.offline}
      open={open}
      problem={copy ? t(copy.key, copy.values) : null}
      title={t(`panel.addTitle.${kind}`)}
      onAdd={() => void submit()}
      onNameChange={add.setTyped}
      onOpenChange={onOpenChange}
    >
      {add.canAddForServer ? (
        <Section placement="panel" title={t("panel.addTo")}>
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
        </Section>
      ) : null}
    </AddPanel>
  );
}
