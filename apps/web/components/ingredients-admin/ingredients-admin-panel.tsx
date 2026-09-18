"use client";

import { useEffect, useMemo, useState } from "react";
import { useIngredientsAdminMutations } from "@/app/(app)/settings/admin/hooks/use-ingredients-admin-mutations";
import { useTRPC } from "@/app/providers/trpc-provider";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import Panel from "@/components/Panel/Panel";
import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { MagnifyingGlassIcon, PhotoIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { Button, Input, Modal, Spinner, TextField, toast } from "@heroui/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

import type { AdminIngredientDto } from "@norish/shared/contracts";

import type { EditingIngredient } from "./ingredient-details-editor-panel";
import {
  canSaveIngredientDetails,
  IngredientDetailsEditorPanel,
} from "./ingredient-details-editor-panel";

/** How often the list is re-read while a picture is being drawn. */
const GENERATION_POLL_MS = 4_000;
/** How long a drawing is waited for before the panel stops watching it. */
const GENERATION_GIVE_UP_MS = 3 * 60_000;
const PAGE_SIZE = 50;

/** A drawing being waited for: when it was asked for, and the picture it will replace. */
type PendingDrawing = { since: number; imageUrl: string | null };

function errorMessage(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

function toEditing(entry: AdminIngredientDto): EditingIngredient {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    imageUrl: entry.imageUrl,
    recipeCount: entry.recipeCount,
  };
}

interface IngredientsAdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every Ingredient Name recipes use (ADR-0037), to search, give a picture,
 * rename, or delete when unused — with the one being edited in a panel of its
 * own over the list. A drawing takes a while, so the panel
 * watches for it by re-reading the list until the picture arrives.
 */
export function IngredientsAdminPanel({ open, onOpenChange }: IngredientsAdminPanelProps) {
  const t = useTranslations("settings.admin.ingredients");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounceValue(search.trim(), 300);

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    ...trpc.admin.ingredients.list.infiniteQueryOptions(
      { search: debouncedSearch || undefined, limit: PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    ),
    enabled: open,
  });
  const { data: missing } = useQuery({
    ...trpc.admin.ingredients.missingImageCount.queryOptions(),
    enabled: open,
  });
  const mutations = useIngredientsAdminMutations();

  const [editing, setEditing] = useState<EditingIngredient | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminIngredientDto | null>(null);
  const [confirmGenerateMissing, setConfirmGenerateMissing] = useState(false);
  const [drawing, setDrawing] = useState<Record<string, PendingDrawing>>({});

  const rows = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);
  const canGenerate = missing?.configured ?? false;
  const drawingIds = useMemo(() => Object.keys(drawing), [drawing]);
  const { invalidate } = mutations;

  // A drawing has landed when its ingredient's picture is no longer the one it
  // replaces, or the ingredient has left the list; the editor follows the
  // stored row so its preview updates too.
  useEffect(() => {
    if (drawingIds.length === 0) return;

    const byId = new Map(rows.map((entry) => [entry.id, entry]));
    const landed = drawingIds.filter((id) => {
      const entry = byId.get(id);

      return !entry || entry.imageUrl !== drawing[id]!.imageUrl;
    });

    if (landed.length === 0) return;

    setDrawing((current) => {
      const next = { ...current };

      for (const id of landed) delete next[id];

      return next;
    });
    setEditing((current) => {
      const entry = current?.id ? byId.get(current.id) : undefined;

      return current && entry && landed.includes(entry.id)
        ? { ...current, imageUrl: entry.imageUrl, version: entry.version }
        : current;
    });
  }, [rows, drawing, drawingIds]);

  useEffect(() => {
    if (!open || drawingIds.length === 0) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      const expired = drawingIds.filter((id) => now - drawing[id]!.since > GENERATION_GIVE_UP_MS);

      if (expired.length > 0) {
        setDrawing((current) => {
          const next = { ...current };

          for (const id of expired) delete next[id];

          return next;
        });
        toast(t("generationSlow"), {
          description: t("generationSlowDescription"),
          variant: "warning",
        });
      }

      void invalidate();
    }, GENERATION_POLL_MS);

    return () => window.clearInterval(timer);
  }, [open, drawing, drawingIds, invalidate, t]);

  /** Watch the drawings of ingredients on screen; the rest are seen when next scrolled to. */
  const watchDrawing = (ids: string[]) => {
    const byId = new Map(rows.map((entry) => [entry.id, entry]));

    setDrawing((current) => {
      const next = { ...current };

      for (const id of ids) {
        const entry = byId.get(id);

        if (entry) next[id] = { since: Date.now(), imageUrl: entry.imageUrl };
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (!editing || !canSaveIngredientDetails(editing)) return;

    setSaveError(null);

    try {
      if (editing.id && editing.version !== null) {
        await mutations.update({
          id: editing.id,
          version: editing.version,
          name: editing.name.trim(),
        });
        setEditing(null);
      } else {
        // A new ingredient stays open, now able to take a picture.
        const created = await mutations.create({ name: editing.name.trim() });

        setEditing(toEditing(created));
      }
    } catch (error) {
      setSaveError(errorMessage(error) ?? t("saveFailed"));
    }
  };

  const runImageAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast(t("pictureFailed"), {
        description: errorMessage(error) ?? undefined,
        variant: "danger",
      });
    }
  };

  const handleUpload = (file: File) => {
    const id = editing?.id;

    if (!id) return;

    void runImageAction(async () => {
      const { imageUrl } = await mutations.uploadImage(id, file);

      setEditing((current) => (current?.id === id ? { ...current, imageUrl } : current));
    });
  };

  const handleGenerate = () => {
    const id = editing?.id;

    if (!id) return;

    void runImageAction(async () => {
      await mutations.generateImage(id);
      watchDrawing([id]);
    });
  };

  const handleRemoveImage = () => {
    const id = editing?.id;

    if (!id) return;

    void runImageAction(async () => {
      await mutations.removeImage(id);
      setEditing((current) => (current?.id === id ? { ...current, imageUrl: null } : current));
    });
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    const { id } = pendingDelete;

    setPendingDelete(null);

    try {
      await mutations.remove(id);
    } catch (error) {
      toast(t("deleteFailed"), {
        description: errorMessage(error) ?? undefined,
        variant: "danger",
      });
    }
  };

  const handleGenerateMissing = async () => {
    setConfirmGenerateMissing(false);

    try {
      const { ids } = await mutations.generateMissing();

      watchDrawing(ids);
    } catch (error) {
      toast(t("pictureFailed"), {
        description: errorMessage(error) ?? undefined,
        variant: "danger",
      });
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEditing(null);
      setSearch("");
    }
    onOpenChange(next);
  };

  const filtered = Boolean(debouncedSearch);
  const deleteInUse = (pendingDelete?.recipeCount ?? 0) > 0;

  return (
    <>
      <Panel open={open} title={t("title")} onOpenChange={handleOpenChange}>
        <Panel.Body>
          <div className="flex flex-col gap-3">
            <TextField aria-label={t("search")} value={search} onChange={setSearch}>
              <div className="relative">
                <MagnifyingGlassIcon className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className={`${FIELD_CLASS} pl-9`}
                  data-testid="ingredients-search"
                  placeholder={t("search")}
                  style={FIELD_STYLE}
                  variant="secondary"
                />
              </div>
            </TextField>

            {canGenerate && (missing?.count ?? 0) > 0 && (
              <Button
                className="self-start"
                data-testid="ingredients-generate-missing"
                size="sm"
                variant="tertiary"
                onPress={() => setConfirmGenerateMissing(true)}
              >
                <SparklesIcon className="size-4" />
                {t("generateMissing", { count: missing?.count ?? 0 })}
              </Button>
            )}

            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}

            {!isLoading && rows.length === 0 && (
              <div className="text-muted py-8 text-center">
                {filtered ? (
                  <p>{t("noMatches")}</p>
                ) : (
                  <>
                    <p>{t("empty")}</p>
                    <p className="text-sm">{t("emptyHint")}</p>
                  </>
                )}
              </div>
            )}

            <ul className="flex flex-col gap-2" data-testid="ingredients-list">
              {rows.map((entry) => (
                <li
                  key={entry.id}
                  className="bg-surface flex items-center gap-3 rounded-lg p-2"
                  data-ingredient-name={entry.name}
                  data-testid="ingredients-row"
                >
                  <div className="bg-surface-secondary relative flex size-10 shrink-0 items-center justify-center rounded-lg">
                    {entry.imageUrl ? (
                      <IngredientIllustration ignoreHidden imageUrl={entry.imageUrl} size="md" />
                    ) : (
                      <PhotoIcon aria-label={t("noPicture")} className="text-muted size-4" />
                    )}
                    {drawing[entry.id] && (
                      <div className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-lg">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.name}</p>
                    <p className="text-muted truncate text-xs">
                      {t("usedBy", { count: entry.recipeCount })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconActionButton
                      action="edit"
                      label={tActions("edit")}
                      size="sm"
                      onPress={() => {
                        setSaveError(null);
                        setEditing(toEditing(entry));
                      }}
                    />
                    <IconActionButton
                      action="delete"
                      label={tActions("delete")}
                      size="sm"
                      onPress={() => setPendingDelete(entry)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {hasNextPage && (
              <Button
                className="self-center"
                data-testid="ingredients-load-more"
                isDisabled={isFetchingNextPage}
                size="sm"
                variant="tertiary"
                onPress={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? <Spinner size="sm" /> : t("loadMore")}
              </Button>
            )}
          </div>
        </Panel.Body>
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton
              action="add"
              data-testid="ingredients-add"
              onPress={() => {
                setSaveError(null);
                setEditing({
                  id: null,
                  name: search.trim(),
                  version: null,
                  imageUrl: null,
                  recipeCount: 0,
                });
              }}
            >
              {t("add")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>

        <IngredientDetailsEditorPanel
          canGenerate={canGenerate}
          editing={editing}
          error={saveError}
          isChangingImage={mutations.isChangingImage}
          isGenerating={Boolean(editing?.id && drawing[editing.id])}
          isSaving={mutations.isSaving}
          onCancel={() => {
            setEditing(null);
            setSaveError(null);
          }}
          onChange={setEditing}
          onGenerate={handleGenerate}
          onRemoveImage={handleRemoveImage}
          onSave={() => void handleSave()}
          onUpload={handleUpload}
        />
      </Panel>

      {/* A name recipes use cannot be deleted: the modal says so instead of offering to. */}
      <ConfirmModal
        danger
        confirmLabel={deleteInUse ? null : tActions("delete")}
        description={
          deleteInUse
            ? t("deleteInUse", {
                name: pendingDelete?.name ?? "",
                count: pendingDelete?.recipeCount ?? 0,
              })
            : t("deleteConfirm", { name: pendingDelete?.name ?? "" })
        }
        isOpen={pendingDelete !== null}
        title={deleteInUse ? t("deleteInUseTitle") : t("deleteTitle")}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmModal
        confirmLabel={t("generateMissingConfirmAction")}
        description={t("generateMissingConfirm", { count: missing?.count ?? 0 })}
        isOpen={confirmGenerateMissing}
        title={t("generateMissingTitle")}
        onClose={() => setConfirmGenerateMissing(false)}
        onConfirm={() => void handleGenerateMissing()}
      />
    </>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  /** Null when there is nothing to confirm, only something to read. */
  confirmLabel: string | null;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  danger = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const tActions = useTranslations("common.actions");

  return (
    // Opens over the ingredients Panel: lifted above the drawer, and opted back in
    // to pointer events vaul turns off on <body> (see DeleteStoreModal).
    <Modal.Backdrop className="pointer-events-auto z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header>{title}</Modal.Header>
          <Modal.Body>
            <p className="text-muted text-base">{description}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {confirmLabel ? tActions("cancel") : tActions("close")}
            </Button>
            {confirmLabel && (
              <Button
                data-testid="ingredients-confirm"
                variant={danger ? "danger" : "primary"}
                onPress={onConfirm}
              >
                {confirmLabel}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
