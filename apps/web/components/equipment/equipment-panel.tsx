"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { showActionToast } from "@/lib/ui/action-toast";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowUturnLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Chip, Input, Skeleton, TextField, toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { EquipmentCatalogueRefusal } from "@norish/shared/contracts/zod/equipment";
import { isEquipmentCatalogueRefusal } from "@norish/shared/contracts/zod/equipment";

import type { EquipmentIconDraft } from "./equipment-icon-field";
import type { EquipmentPick } from "./equipment-picker";
import type { EquipmentItem, EquipmentSpelling } from "./types";
import { DeleteEquipmentModal } from "./delete-equipment-modal";
import { EquipmentIconField } from "./equipment-icon-field";
import { EquipmentPicker } from "./equipment-picker";
import { useEquipmentCache } from "./use-equipment-cache";

function refusalOf(error: unknown): EquipmentCatalogueRefusal | null {
  const message = error instanceof Error ? error.message : null;

  return isEquipmentCatalogueRefusal(message) ? message : null;
}

export function EquipmentPanel({
  id = null,
  item,
  open,
  nested = false,
  onClose,
  onChanged,
}: {
  id?: string | null;
  item: EquipmentItem | null;
  open: boolean;
  nested?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const trpc = useTRPC();
  const [shown, setShown] = useState<EquipmentItem | null>(item);
  const ownId = id ?? shown?.id ?? null;
  const own = useQuery({
    ...trpc.equipment.get.queryOptions({ equipmentId: ownId ?? "" }),
    enabled: open && ownId !== null && item === null,
  });
  const current: EquipmentItem | null = item ?? own.data ?? null;
  const [usesOf, setUsesOf] = useState<{ id: string; name: string } | null>(null);
  const [usesOpen, setUsesOpen] = useState(false);

  if (current && current !== shown) setShown(current);

  if (!shown || (open && id !== null && shown.id !== id && !current)) return null;

  return (
    <>
      <EquipmentPanelContent
        key={shown.id}
        item={shown}
        nested={nested}
        open={open}
        onChanged={onChanged}
        onClose={onClose}
        onShowUses={(equip) => {
          setUsesOf(equip);
          setUsesOpen(true);
        }}
      />
      {usesOf ? (
        <EquipmentUsesPanel
          equipmentId={usesOf.id}
          name={usesOf.name}
          nested={nested}
          open={usesOpen}
          onClose={() => setUsesOpen(false)}
        />
      ) : null}
    </>
  );
}

function EquipmentPanelContent({
  item,
  open,
  nested,
  onClose,
  onChanged,
  onShowUses,
}: {
  item: EquipmentItem;
  open: boolean;
  nested: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onShowUses: (equip: { id: string; name: string }) => void;
}) {
  const t = useTranslations("settings.equipment");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const cache = useEquipmentCache();

  const [name, setName] = useState(item.name);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [icon, setIcon] = useState<EquipmentIconDraft>(undefined);
  const [alias, setAlias] = useState("");
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const keepDraftRef = useRef(false);

  useEffect(() => {
    if (keepDraftRef.current) {
      keepDraftRef.current = false;

      return;
    }
    setName(item.name);
  }, [item.name]);

  const saveDraft = useMutation(trpc.equipment.saveDraft.mutationOptions());
  const merge = useMutation(trpc.equipment.merge.mutationOptions());
  const remove = useMutation(trpc.equipment.remove.mutationOptions());
  const busy = saveDraft.isPending || merge.isPending || remove.isPending;

  const run = async (context: string, show: () => void, edit: () => Promise<unknown>) => {
    try {
      show();
      await edit();
    } catch (error) {
      void cache.rollback();
      const refusal = refusalOf(error);

      if (refusal === "alias-in-use" || refusal === "ingredient-in-use") {
        showActionToast(t("errors.title"), {
          description: t(`errors.${refusal}`),
          variant: "danger",
          action: {
            label: t("uses.show"),
            onPress: () => onShowUses({ id: item.id, name: item.name }),
          },
        });

        return false;
      }
      showSafeErrorToast({
        title: t("errors.title"),
        description: refusal ? t(`errors.${refusal}`) : t("errors.unknown"),
        error,
        context: `equipment:${context}`,
      });

      return false;
    }
    onChanged?.();

    return true;
  };

  const nextName = name.trim();
  const nameChanged = nextName !== "" && nextName !== item.name;
  const iconChanged = icon !== undefined;
  const dirty = nameChanged || iconChanged || added.length > 0 || removed.size > 0;

  const save = async () => {
    if (!dirty || busy) return;
    const draft = { added, removed, icon };

    setAdded([]);
    setRemoved(new Set());
    setIcon(undefined);
    const saved = await run(
      "save",
      () =>
        cache.patchRow(item.id, (row) => ({
          ...row,
          ...(nameChanged ? { name: nextName } : {}),
          ...(iconChanged ? { icon: icon?.address ?? null, ownIcon: Boolean(icon) } : {}),
          aliases: [
            ...row.aliases.filter((spelling) => !removed.has(spelling.id)),
            ...added.map((text) => ({ id: `draft:${text}`, text, canRemove: true })),
          ],
        })),
      () =>
        saveDraft.mutateAsync({
          equipmentId: item.id,
          ...(nameChanged ? { name: nextName } : {}),
          add: added,
          remove: [...removed],
          ...(iconChanged ? { icon: icon?.file ?? null } : {}),
        })
    );

    if (!saved) {
      keepDraftRef.current = true;
      setAdded(draft.added);
      setRemoved(draft.removed);
      setName(nextName);
      setIcon(draft.icon);
    } else if (iconChanged) {
      void queryClient.invalidateQueries({ queryKey: trpc.equipment.icons.pathKey() });
    }
  };

  const stageAlias = () => {
    const text = alias.trim();

    if (!text) return;
    if (!added.includes(text)) setAdded((current) => [...current, text]);
    setAlias("");
  };

  const confirmMerge = (target: EquipmentPick) => {
    setMerging(false);
    onClose();
    toast(t("mergedToast", { name: item.name, into: target.name }), { variant: "success" });
    void run(
      "merge",
      () => cache.dropRow(item.id),
      async () => {
        await merge.mutateAsync({ sourceId: item.id, targetId: target.id });
        void queryClient.invalidateQueries({ queryKey: trpc.equipment.list.pathKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.equipment.icons.pathKey() });
      }
    );
  };

  const confirmDelete = () => {
    setDeleting(false);
    onClose();
    void run(
      "delete",
      () => cache.dropRow(item.id),
      () => remove.mutateAsync({ equipmentId: item.id })
    );
  };

  const spellingChip = (spelling: EquipmentSpelling) => {
    const pendingRemoval = removed.has(spelling.id);

    return (
      <Chip
        key={spelling.id}
        className={pendingRemoval ? "line-through opacity-60" : undefined}
        data-pending={pendingRemoval ? "removed" : undefined}
        data-testid="equipment-alias"
        size="sm"
        variant="tertiary"
      >
        {spelling.text}
        {spelling.canRemove && !spelling.inUse ? (
          <button
            aria-label={
              pendingRemoval
                ? t("keepAlias", { alias: spelling.text })
                : t("removeAlias", { alias: spelling.text })
            }
            className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
            data-testid="equipment-alias-remove"
            disabled={busy}
            type="button"
            onClick={() =>
              setRemoved((current) => {
                const next = new Set(current);

                if (pendingRemoval) next.delete(spelling.id);
                else next.add(spelling.id);

                return next;
              })
            }
          >
            {pendingRemoval ? (
              <ArrowUturnLeftIcon className="size-3" />
            ) : (
              <XMarkIcon className="size-3" />
            )}
          </button>
        ) : null}
      </Chip>
    );
  };

  return (
    <Panel
      nested={nested}
      open={open}
      title={item.name}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="equipment-details">
          <Section title={t("nameSection")}>
            <div className="flex items-center gap-3">
              <EquipmentIconField
                busy={busy}
                canEdit={item.canEdit}
                currentIcon={item.icon}
                draft={icon}
                equipmentId={item.id}
                ownIcon={item.ownIcon}
                onDraftChange={setIcon}
              />
              {item.canEdit ? (
                <TextField
                  aria-label={t("rename")}
                  className="min-w-0 flex-1"
                  isDisabled={busy}
                  value={name}
                  onChange={setName}
                >
                  <Input
                    data-testid="equipment-name-input"
                    variant="secondary"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void save();
                      if (event.key === "Escape") setName(item.name);
                    }}
                  />
                </TextField>
              ) : (
                <p className="font-medium">{item.name}</p>
              )}
            </div>
          </Section>

          <Section title={t("spellingsSection")}>
            <div className="flex flex-col gap-3">
              <div
                className="flex flex-wrap items-center gap-1"
                data-testid="equipment-spellings-all"
              >
                {item.aliases.map(spellingChip)}
                {added.map((text) => (
                  <Chip
                    key={`new-${text}`}
                    color="accent"
                    data-pending="added"
                    data-testid="equipment-alias"
                    size="sm"
                    variant="soft"
                  >
                    {text}
                    <button
                      aria-label={t("removeAlias", { alias: text })}
                      className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                      data-testid="equipment-alias-remove"
                      disabled={busy}
                      type="button"
                      onClick={() => setAdded((current) => current.filter((it) => it !== text))}
                    >
                      <XMarkIcon className="size-3" />
                    </button>
                  </Chip>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <TextField
                  aria-label={t("addAlias")}
                  className="min-w-0 flex-1"
                  isDisabled={busy}
                  value={alias}
                  onChange={setAlias}
                >
                  <Input
                    data-testid="equipment-alias-input"
                    placeholder={t("addAlias")}
                    variant="secondary"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") stageAlias();
                    }}
                  />
                </TextField>
                <IconActionButton
                  action="add"
                  isDisabled={busy || !alias.trim()}
                  label={t("addAlias")}
                  variant="tertiary"
                  onPress={stageAlias}
                />
              </div>
            </div>
          </Section>
        </div>
      </Panel.Body>

      <Panel.Footer>
        <ActionButtonGroup
          start={
            item.canEdit ? (
              <ActionButton
                action="delete"
                data-testid="equipment-delete"
                isDisabled={busy}
                onPress={() => setDeleting(true)}
              >
                {t("delete")}
              </ActionButton>
            ) : null
          }
        >
          {item.canEdit ? (
            <ActionButton
              action="merge"
              data-testid="equipment-merge"
              isDisabled={busy}
              onPress={() => setMerging(true)}
            >
              {t("merge")}
            </ActionButton>
          ) : null}
          <ActionButton
            action="save"
            data-testid="equipment-save"
            isDisabled={busy || !dirty}
            onPress={() => void save()}
          >
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>

      <EquipmentMergePanel
        busy={busy}
        equipment={{ id: item.id, name: item.name }}
        open={merging}
        onClose={() => setMerging(false)}
        onConfirm={confirmMerge}
      />

      <DeleteEquipmentModal
        isOpen={deleting}
        name={item.name}
        onClose={() => setDeleting(false)}
        onConfirm={confirmDelete}
      />
    </Panel>
  );
}

function EquipmentMergePanel({
  open,
  equipment,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  equipment: { id: string; name: string };
  busy: boolean;
  onConfirm: (target: EquipmentPick) => void;
  onClose: () => void;
}) {
  const t = useTranslations("settings.equipment");
  const tActions = useTranslations("common.actions");
  const [target, setTarget] = useState<EquipmentPick | null>(null);

  const close = () => {
    setTarget(null);
    onClose();
  };

  return (
    <Panel
      nested
      open={open}
      title={t("mergeInto")}
      onOpenChange={(isOpen) => {
        if (!isOpen) close();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-3" data-testid="equipment-merge-panel">
          <p className="text-muted text-sm">{t("mergeTitle", { name: equipment.name })}</p>
          <EquipmentPicker
            key={open ? equipment.id : "closed"}
            editableOnly
            excludeId={equipment.id}
            label={t("mergeInto")}
            onPick={setTarget}
          />
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="cancel" isDisabled={busy} onPress={close}>
            {tActions("cancel")}
          </ActionButton>
          <ActionButton
            action="apply"
            data-testid="equipment-merge-confirm"
            isDisabled={busy || !target}
            isPending={busy}
            onPress={() => {
              if (target) onConfirm(target);
            }}
          >
            {t("merge")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}

export function CreateEquipmentPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (equipmentId: string) => void;
}) {
  const t = useTranslations("settings.equipment");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const create = useMutation(trpc.equipment.create.mutationOptions());

  const [name, setName] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [alias, setAlias] = useState("");
  const [icon, setIcon] = useState<EquipmentIconDraft>(undefined);

  const close = () => {
    setName("");
    setAdded([]);
    setAlias("");
    setIcon(undefined);
    onClose();
  };

  const busy = create.isPending;
  const nextName = name.trim();

  const stageAlias = () => {
    const text = alias.trim();

    if (!text) return;
    if (!added.includes(text)) setAdded((current) => [...current, text]);
    setAlias("");
  };

  const handleSave = async () => {
    if (!nextName || busy) return;
    try {
      const created = await create.mutateAsync({
        name: nextName,
        aliases: added,
        icon: icon?.file ?? null,
      });

      close();
      onCreated?.(created.equipmentId);
    } catch (error) {
      const refusal = refusalOf(error);

      showSafeErrorToast({
        title: t("errors.title"),
        description: refusal ? t(`errors.${refusal}`) : t("errors.unknown"),
        error,
        context: "equipment:create",
      });
    }
  };

  return (
    <Panel
      open={open}
      title={t("createTitle")}
      onOpenChange={(isOpen) => {
        if (!isOpen) close();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="equipment-create-details">
          <Section title={t("nameSection")}>
            <div className="flex items-center gap-3">
              <EquipmentIconField
                canEdit
                busy={busy}
                currentIcon={null}
                draft={icon}
                ownIcon={false}
                onDraftChange={setIcon}
              />
              <TextField
                aria-label={t("rename")}
                className="min-w-0 flex-1"
                isDisabled={busy}
                value={name}
                onChange={setName}
              >
                <Input
                  data-testid="equipment-create-name-input"
                  placeholder={t("namePlaceholder")}
                  variant="secondary"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSave();
                  }}
                />
              </TextField>
            </div>
          </Section>

          <Section title={t("spellingsSection")}>
            <div className="flex flex-col gap-3">
              {added.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  {added.map((text) => (
                    <Chip
                      key={`new-${text}`}
                      color="accent"
                      data-testid="equipment-alias"
                      size="sm"
                      variant="soft"
                    >
                      {text}
                      <button
                        aria-label={t("removeAlias", { alias: text })}
                        className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                        disabled={busy}
                        type="button"
                        onClick={() => setAdded((current) => current.filter((it) => it !== text))}
                      >
                        <XMarkIcon className="size-3" />
                      </button>
                    </Chip>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <TextField
                  aria-label={t("addAlias")}
                  className="min-w-0 flex-1"
                  isDisabled={busy}
                  value={alias}
                  onChange={setAlias}
                >
                  <Input
                    data-testid="equipment-create-alias-input"
                    placeholder={t("addAlias")}
                    variant="secondary"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") stageAlias();
                    }}
                  />
                </TextField>
                <IconActionButton
                  action="add"
                  isDisabled={busy || !alias.trim()}
                  label={t("addAlias")}
                  variant="tertiary"
                  onPress={stageAlias}
                />
              </div>
            </div>
          </Section>
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton
            action="save"
            data-testid="equipment-create-save"
            isDisabled={busy || !nextName}
            onPress={() => void handleSave()}
          >
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}

function EquipmentUsesPanel({
  equipmentId,
  name,
  nested,
  open,
  onClose,
}: {
  equipmentId: string;
  name: string;
  nested: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.equipment.uses");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.equipment.uses.queryOptions({ equipmentId }),
    enabled: open,
  });
  const unused = data && data.recipes.length === 0 && data.elsewhere === 0;

  return (
    <Panel
      nested={nested}
      open={open}
      title={t("title", { name })}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="equipment-uses">
          {!data ? <Skeleton className="h-16 w-full rounded-xl" /> : null}
          {data && data.recipes.length > 0 ? (
            <Section title={t("recipes")}>
              <ul className="flex flex-col gap-1 text-sm">
                {data.recipes.map((recipe) => (
                  <li key={recipe.id}>
                    <Link
                      className="text-accent hover:underline"
                      href={`/recipes/${recipe.id}`}
                      onClick={onClose}
                    >
                      {recipe.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {data && data.elsewhere > 0 ? (
            <p className="text-muted text-sm">{t("elsewhere", { count: data.elsewhere })}</p>
          ) : null}
          {unused ? <p className="text-muted text-sm">{t("none")}</p> : null}
        </div>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="done" onPress={onClose}>
            {tActions("done")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}
