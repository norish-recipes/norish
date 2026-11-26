"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { SkeletonRows } from "@/components/settings/settings-skeleton";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ExclamationTriangleIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Button, InputGroup, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ContentEntry, ContentSection, PickerKind } from "@norish/shared-react/lists";
import { useContentList } from "@norish/shared-react/lists";

import type { ContentList } from "./content-lists";
import { LIST_ICONS } from "./content-lists";
import { EntryAddPanel } from "./entry-add-panel";
import { EntryPanel } from "./entry-panel";

/** What a panel is for: a new entry, or an existing one. */
type Target = { kind: "add" } | { kind: "entry"; id: string };

/** Why a list shows no rows, said as a line in the list's place. */
function Notice({ children }: { children: string }) {
  return <p className="text-muted px-4 py-6 text-center text-base">{children}</p>;
}

function SectionTitle({
  section,
  kind,
  admin,
}: {
  section: ContentSection;
  kind: PickerKind;
  admin: boolean;
}) {
  const t = useTranslations("settings.content");
  const instance = section.scope === "instance";
  let title = kind === "cuisine" ? t("sections.ownCuisines") : t("sections.ownCategories");

  if (instance) title = kind === "category" ? t("sections.builtIn") : t("sections.server");

  let help: string | null = null;

  if (instance) {
    if (kind === "category") help = t("help.builtIn");
    else help = admin ? t("help.serverAdmin") : t("help.server");
  }

  return (
    <h3 className="text-muted flex flex-col gap-0.5 text-sm font-semibold">
      {title}
      {help ? <span className="text-xs font-normal">{help}</span> : null}
    </h3>
  );
}

/** One entry on a line: its name, how many of the household's recipes carry it, a lock when it is read only. */
function EntryRow({ entry, onOpen }: { entry: ContentEntry; onOpen: (id: string) => void }) {
  const t = useTranslations("settings.content");

  return (
    <li>
      <button
        className="hover:bg-default/40 focus-visible:ring-focus flex min-h-12 w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-4 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
        data-entry={entry.name}
        data-testid="content-entry"
        type="button"
        onClick={() => onOpen(entry.id)}
      >
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        <span className="text-muted text-sm tabular-nums">
          {t("recipes", { count: entry.recipeCount })}
        </span>
        {entry.editable ? null : (
          <span aria-label={t("readOnly")} role="img">
            <LockClosedIcon aria-hidden className="text-muted size-4 shrink-0" />
          </span>
        )}
      </button>
    </li>
  );
}

/** A list of Tags, Cuisines or Categories: search, the unused filter, Add, and a panel per entry. */
export function EntryListCard({ kind, list }: { kind: PickerKind; list: ContentList }) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");
  const {
    entries,
    loaded,
    failed,
    retry,
    offline,
    search,
    setSearch,
    unusedOnly,
    setUnusedOnly,
    view,
  } = useContentList(kind);
  const [opened, setOpened] = useState<{ target: Target; nonce: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const Icon = LIST_ICONS[list];
  const admin = entries.some((entry) => entry.instance && entry.editable);
  // A new `nonce` per opening, so a panel never keeps the draft of the last one.
  const open = (target: Target) => {
    setOpened({ target, nonce: (opened?.nonce ?? 0) + 1 });
    setPanelOpen(true);
  };
  const addButton = (
    <ActionButton action="add" data-testid="content-add" onPress={() => open({ kind: "add" })}>
      {tActions("add")}
    </ActionButton>
  );
  const panels = opened ? (
    opened.target.kind === "add" ? (
      <EntryAddPanel
        key={opened.nonce}
        kind={kind}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onOpenEntry={(id) => open({ kind: "entry", id })}
      />
    ) : (
      <EntryPanel
        key={opened.nonce}
        id={opened.target.id}
        kind={kind}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    )
  ) : null;

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

  if (loaded && view.state === "empty") {
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
      <SettingsCard actions={loaded ? addButton : null} icon={Icon} title={t(`lists.${list}`)}>
        {loaded ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <TextField
                aria-label={t(`search.${list}`)}
                className="min-w-0 flex-1"
                value={search}
                onChange={setSearch}
              >
                <InputGroup variant="secondary">
                  <InputGroup.Prefix className="pl-3">
                    <MagnifyingGlassIcon aria-hidden className="text-muted size-5" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    data-testid="content-search"
                    placeholder={t(`search.${list}`)}
                  />
                </InputGroup>
              </TextField>
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
            {offline ? <p className="text-muted text-sm">{t("offline")}</p> : null}
            {view.state === "nothingUnused" ? <Notice>{t("nothingUnused")}</Notice> : null}
            {view.state === "noMatch" ? <Notice>{t("noMatch")}</Notice> : null}
            {view.sections.map((section) => (
              <section key={section.scope} className="flex flex-col gap-2">
                {view.titled ? <SectionTitle admin={admin} kind={kind} section={section} /> : null}
                <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
                  {section.entries.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onOpen={(id) => open({ kind: "entry", id })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <div aria-busy className="flex flex-col gap-4" data-testid="content-loading">
            <SkeletonRows count={6} />
          </div>
        )}
      </SettingsCard>
      {panels}
    </>
  );
}
