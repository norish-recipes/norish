"use client";

import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFrame, ListRow } from "@/components/shared/list-row";
import { Note } from "@/components/shared/note";
import { SearchField } from "@/components/shared/search-field";
import { Section } from "@/components/shared/section";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PickerKind } from "@norish/shared-react/lists";
import { useContentList, useContentTarget } from "@norish/shared-react/lists";

import type { ContentList } from "./content-lists";
import { LIST_ICONS } from "./content-lists";
import { EntryListSkeleton } from "./content-skeleton";
import { EntryAddPanel } from "./entry-add-panel";
import { EntryPanel } from "./entry-panel";

/** A list of Tags, Cuisines or Categories: search, the unused filter, Add, and a panel per entry. */
export function EntryListCard({ kind, list }: { kind: PickerKind; list: ContentList }) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");
  const { loaded, failed, retry, offline, search, setSearch, unusedOnly, setUnusedOnly, view } =
    useContentList(kind);
  const panel = useContentTarget();
  const Icon = LIST_ICONS[list];
  const addButton = (
    <ActionButton action="add" data-testid="content-add" onPress={panel.openAdd}>
      {tActions("add")}
    </ActionButton>
  );
  const panels =
    panel.target?.kind === "add" ? (
      <EntryAddPanel
        key={panel.nonce}
        kind={kind}
        open={panel.open}
        onOpenChange={panel.setOpen}
        onOpenEntry={panel.openEntry}
      />
    ) : panel.target ? (
      <EntryPanel
        key={panel.nonce}
        id={panel.target.id}
        kind={kind}
        open={panel.open}
        onOpenChange={panel.setOpen}
      />
    ) : null;
  const notice = (key: "nothingUnused" | "noMatch") => (
    <EmptyState data-testid={`content-${key}`} icon={Icon} title={t(key)} variant="row" />
  );

  if (failed) {
    return (
      <SettingsCard
        empty={
          <EmptyState
            action={
              <Button variant="tertiary" onPress={retry}>
                {tActions("retry")}
              </Button>
            }
            data-testid="content-failed"
            icon={ExclamationTriangleIcon}
            title={t("loadFailed")}
            variant="row"
          />
        }
        icon={Icon}
        title={t(`lists.${list}`)}
      />
    );
  }

  if (!loaded) return <EntryListSkeleton list={list} />;

  if (view.state === "empty") {
    return (
      <>
        <SettingsCard
          empty={
            <EmptyState
              action={addButton}
              data-testid="content-empty"
              icon={Icon}
              title={t(`empty.${list}`)}
              variant="row"
            />
          }
          icon={Icon}
          title={t(`lists.${list}`)}
        />
        {panels}
      </>
    );
  }

  return (
    <>
      <SettingsCard actions={addButton} icon={Icon} title={t(`lists.${list}`)}>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            data-testid="content-search"
            label={t(`search.${list}`)}
            value={search}
            onChange={setSearch}
          />
          <ToggleButtonGroup
            aria-label={t("show")}
            disallowEmptySelection
            selectedKeys={[unusedOnly ? "unused" : "all"]}
            selectionMode="single"
            size="sm"
            onSelectionChange={(keys) => setUnusedOnly(keys.has("unused"))}
          >
            <ToggleButton data-testid="content-show-all" id="all">
              {t("all")}
            </ToggleButton>
            <ToggleButton data-testid="content-show-unused" id="unused">
              <ToggleButtonGroup.Separator />
              {t("unused")}
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        {offline ? <Note>{t("offline")}</Note> : null}
        {view.state === "nothingUnused" || view.state === "noMatch" ? notice(view.state) : null}
        {view.sections.map((section) => (
          <Section
            key={section.scope}
            help={section.help ? t(`help.${section.help}`) : undefined}
            placement="card"
            title={section.title ? t(`sections.${section.title}`) : undefined}
          >
            <ListFrame>
              {section.entries.map((entry) => (
                <ListRow
                  key={entry.id}
                  count={t("recipes", { count: entry.recipeCount })}
                  data-entry={entry.name}
                  data-testid="content-entry"
                  lockLabel={entry.editable ? undefined : t("readOnly")}
                  name={entry.name}
                  onPress={() => panel.openEntry(entry.id)}
                />
              ))}
            </ListFrame>
          </Section>
        ))}
      </SettingsCard>
      {panels}
    </>
  );
}
