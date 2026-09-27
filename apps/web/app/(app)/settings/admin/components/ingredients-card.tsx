"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { FIELD_CLASS, FIELD_STYLE } from "@/components/groceries/grocery-field";
import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";
import { ActionButton, IconActionButton } from "@/components/shared/action-button";
import DataTable from "@/components/ui/data-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PhotoIcon as PhotoIconSolid,
  SparklesIcon,
} from "@heroicons/react/16/solid";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, Pagination, Spinner, TextField, toast } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

import type { AdminIngredientDto } from "@norish/shared/contracts";

import type { EditingIngredient } from "./ingredients/ingredient-editor-modal";
import { useIngredientsAdminMutations } from "../hooks/use-ingredients-admin-mutations";
import { IngredientConfirmModal } from "./ingredients/ingredient-confirm-modal";
import {
  canSaveIngredientDetails,
  IngredientEditorModal,
} from "./ingredients/ingredient-editor-modal";

/** How often the list is re-read while a picture is being drawn. */
const GENERATION_POLL_MS = 4_000;
/** How long a drawing is waited for before the card stops watching it. */
const GENERATION_GIVE_UP_MS = 3 * 60_000;
const PAGE_SIZE = 15;

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

/**
 * Ingredients (ADR-0037): every Ingredient Name recipes use, a page at a time,
 * to search, give a picture, rename, or delete when unused — with the one
 * being added or edited in a modal over the table. A drawing takes a while, so
 * the card watches for it by re-reading the page until the picture arrives.
 */
export default function IngredientsCard() {
  const t = useTranslations("settings.admin.ingredients");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounceValue(search.trim(), 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    ...trpc.admin.ingredients.list.queryOptions({
      search: debouncedSearch || undefined,
      cursor: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    // The page stays on screen while the next one loads, so the table does
    // not collapse to its empty state between pages.
    placeholderData: keepPreviousData,
  });
  const { data: missing } = useQuery(trpc.admin.ingredients.missingImageCount.queryOptions());
  const mutations = useIngredientsAdminMutations();

  const [editing, setEditing] = useState<EditingIngredient | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminIngredientDto | null>(null);
  const [confirmGenerateMissing, setConfirmGenerateMissing] = useState(false);
  const [drawing, setDrawing] = useState<Record<string, PendingDrawing>>({});

  const rows = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGenerate = missing?.configured ?? false;
  const drawingIds = useMemo(() => Object.keys(drawing), [drawing]);
  const { invalidate } = mutations;

  // A delete can empty the last page; step back to the one that is now last.
  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  // A drawing has landed when its ingredient's picture is no longer the one it
  // replaces, or the ingredient has left the page; the editor follows the
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
    if (drawingIds.length === 0) return;

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
  }, [drawing, drawingIds, invalidate, t]);

  /** Watch the drawings of ingredients on this page; the rest are seen when their page is shown. */
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

  const openEditor = (next: EditingIngredient) => {
    setSaveError(null);
    setEditing(next);
  };

  const closeEditor = () => {
    setEditing(null);
    setSaveError(null);
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

  const deleteInUse = (pendingDelete?.recipeCount ?? 0) > 0;
  // The empty slot is the only place this table can speak from, so a failed
  // load, a search with no matches and a server with no names read differently.
  const emptyState = isLoading
    ? t("loading")
    : error
      ? t("loadFailed")
      : debouncedSearch
        ? t("noMatches")
        : `${t("empty")} ${t("emptyHint")}`;

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PhotoIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TextField
            aria-label={t("search")}
            className="flex-1"
            value={search}
            onChange={(next) => {
              // A new search starts from its first page.
              setSearch(next);
              setPage(1);
            }}
          >
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
          <div className="flex flex-wrap gap-2">
            {canGenerate && (missing?.count ?? 0) > 0 && (
              <Button
                data-testid="ingredients-generate-missing"
                variant="tertiary"
                onPress={() => setConfirmGenerateMissing(true)}
              >
                <SparklesIcon className="size-4" />
                {t("generateMissing", { count: missing?.count ?? 0 })}
              </Button>
            )}
            <ActionButton
              action="add"
              data-testid="ingredients-add"
              onPress={() =>
                openEditor({
                  id: null,
                  name: search.trim(),
                  version: null,
                  imageUrl: null,
                  recipeCount: 0,
                })
              }
            >
              {t("add")}
            </ActionButton>
          </div>
        </div>

        <DataTable
          aria-label={t("title")}
          columns={[
            {
              key: "ingredient",
              label: t("table.ingredient"),
              isRowHeader: true,
              render: (row: AdminIngredientDto) => (
                <div
                  className="flex min-w-0 items-center gap-3"
                  data-ingredient-name={row.name}
                  data-testid="ingredients-row"
                >
                  <div className="bg-surface-secondary relative flex size-10 shrink-0 items-center justify-center rounded-lg">
                    {row.imageUrl ? (
                      <IngredientIllustration ignoreHidden imageUrl={row.imageUrl} size="md" />
                    ) : (
                      <PhotoIconSolid aria-label={t("noPicture")} className="text-muted size-4" />
                    )}
                    {drawing[row.id] && (
                      <div className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-lg">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </div>
                  <span className="truncate font-medium">{row.name}</span>
                </div>
              ),
            },
            {
              key: "usage",
              hideOnNarrow: true,
              label: t("table.usage"),
              className: "text-sm",
              render: (row: AdminIngredientDto) => t("usedBy", { count: row.recipeCount }),
            },
            {
              key: "actions",
              align: "center",
              label: t("table.actions"),
              render: (row: AdminIngredientDto) => (
                <div className="flex justify-center gap-1">
                  <IconActionButton
                    action="edit"
                    label={tActions("edit")}
                    onPress={() => openEditor(toEditing(row))}
                  />
                  <IconActionButton
                    action="delete"
                    label={tActions("delete")}
                    onPress={() => setPendingDelete(row)}
                  />
                </div>
              ),
            },
          ]}
          emptyState={emptyState}
          rowKey={(row: AdminIngredientDto) => row.id}
          rows={rows}
        />

        {isLoading || error ? null : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted text-xs" data-testid="ingredients-summary">
              {t("summary", { count: total })}
            </p>
            {totalPages > 1 ? (
              <Pagination aria-label={t("title")} size="sm">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      data-testid="ingredients-previous-page"
                      isDisabled={page === 1}
                      onPress={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Pagination.Previous>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Summary>
                      {t("pagination", { current: page, total: totalPages })}
                    </Pagination.Summary>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Next
                      data-testid="ingredients-next-page"
                      isDisabled={page >= totalPages}
                      onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            ) : null}
          </div>
        )}
      </Card.Content>

      <IngredientEditorModal
        canGenerate={canGenerate}
        editing={editing}
        error={saveError}
        isChangingImage={mutations.isChangingImage}
        isGenerating={Boolean(editing?.id && drawing[editing.id])}
        isSaving={mutations.isSaving}
        onCancel={closeEditor}
        onChange={setEditing}
        onGenerate={handleGenerate}
        onRemoveImage={handleRemoveImage}
        onSave={() => void handleSave()}
        onUpload={handleUpload}
      />

      {/* A name recipes use cannot be deleted: the modal says so instead of offering to. */}
      <IngredientConfirmModal
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

      <IngredientConfirmModal
        confirmLabel={t("generateMissingConfirmAction")}
        description={t("generateMissingConfirm", { count: missing?.count ?? 0 })}
        isOpen={confirmGenerateMissing}
        title={t("generateMissingTitle")}
        onClose={() => setConfirmGenerateMissing(false)}
        onConfirm={() => void handleGenerateMissing()}
      />
    </Card>
  );
}
