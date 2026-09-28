"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UiSwitch from "@/app/(app)/settings/components/settings-switch";
import { useTRPC } from "@/app/providers/trpc-provider";
import { IconActionButton } from "@/components/shared/action-button";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowRightIcon, BookOpenIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Card, Chip, Input, TextField } from "@heroui/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { CatalogueRefusal } from "@norish/shared/contracts/ingredient-catalogue";
import { isCatalogueRefusal } from "@norish/shared/contracts/ingredient-catalogue";

import type { IngredientPick } from "./ingredient-picker";
import { IngredientPicker } from "./ingredient-picker";

/** Why the server refused an edit, as the procedures name it. */
function refusalOf(error: unknown): CatalogueRefusal | null {
  const message = error instanceof Error ? error.message : null;

  return isCatalogueRefusal(message) ? message : null;
}

/** How long typing pauses before the list is searched again. */
const SEARCH_DELAY_MS = 250;

interface IngredientItem {
  id: string;
  name: string;
  flagged: boolean;
  canEdit: boolean;
  /** `canRemove` is `edit` on the alias, which moving it needs too. */
  aliases: Array<{ id: string; text: string; canRemove: boolean }>;
}

/** What the row is asking the viewer to pick a target for, if anything. */
type Relocation = { kind: "merge" } | { kind: "move"; aliasId: string; text: string };

/**
 * The catalogue of Ingredients (ADR-0037): every food Norish knows, each with
 * the spellings it is known by, and the ones Norish was not sure about
 * marked. An action the viewer may not take is not offered; the server says
 * which, row by row.
 */
export default function IngredientsSettingsContent() {
  const t = useTranslations("settings.ingredients");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [searchText]);

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery(
    trpc.ingredients.list.infiniteQueryOptions(
      { search: search || undefined, flaggedOnly },
      { getNextPageParam: (page) => page.nextCursor }
    )
  );
  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: trpc.ingredients.list.pathKey() });

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BookOpenIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextField
            aria-label={t("search")}
            className="min-w-0 flex-1"
            value={searchText}
            onChange={setSearchText}
          >
            <Input data-testid="ingredients-search" placeholder={t("search")} variant="secondary" />
          </TextField>
          <UiSwitch
            data-testid="ingredients-flagged-only"
            isSelected={flaggedOnly}
            onValueChange={setFlaggedOnly}
          >
            <span className="text-sm">{t("flaggedOnly")}</span>
          </UiSwitch>
        </div>

        {!isLoading && items.length === 0 ? (
          <p className="text-muted py-6 text-center" data-testid="ingredients-empty">
            {flaggedOnly ? t("emptyFlagged") : t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="ingredients-list">
            {items.map((item) => (
              <IngredientRow key={item.id} item={item} onChanged={refresh} />
            ))}
          </ul>
        )}

        {hasNextPage ? (
          <Button
            className="self-center"
            isDisabled={isFetchingNextPage}
            variant="tertiary"
            onPress={() => void fetchNextPage()}
          >
            {t("loadMore")}
          </Button>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function IngredientRow({ item, onChanged }: { item: IngredientItem; onChanged: () => void }) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  const [alias, setAlias] = useState("");
  const [relocation, setRelocation] = useState<Relocation | null>(null);
  const [target, setTarget] = useState<IngredientPick | null>(null);
  const nameField = useRef<HTMLInputElement>(null);

  // The name field takes focus when the viewer asks to rename, not on load.
  useEffect(() => {
    if (renaming) nameField.current?.focus();
  }, [renaming]);

  const rename = useMutation(trpc.ingredients.rename.mutationOptions());
  const markDistinct = useMutation(trpc.ingredients.markDistinct.mutationOptions());
  const addAlias = useMutation(trpc.ingredients.addAlias.mutationOptions());
  const removeAlias = useMutation(trpc.ingredients.removeAlias.mutationOptions());
  const merge = useMutation(trpc.ingredients.merge.mutationOptions());
  const moveAlias = useMutation(trpc.ingredients.moveAlias.mutationOptions());
  const busy =
    rename.isPending ||
    markDistinct.isPending ||
    addAlias.isPending ||
    merge.isPending ||
    moveAlias.isPending;

  const run = async (context: string, edit: () => Promise<unknown>) => {
    try {
      await edit();
      onChanged();

      return true;
    } catch (error) {
      const refusal = refusalOf(error);

      showSafeErrorToast({
        title: t("errors.title"),
        description: refusal ? t(`errors.${refusal}`) : t("errors.unknown"),
        error,
        context: `ingredients:${context}`,
      });

      return false;
    }
  };

  const saveName = async () => {
    const next = name.trim();

    if (!next || next === item.name) {
      setRenaming(false);

      return;
    }
    if (await run("rename", () => rename.mutateAsync({ ingredientId: item.id, name: next }))) {
      setRenaming(false);
    }
  };

  const relocate = (next: Relocation | null) => {
    setTarget(null);
    setRelocation(next);
  };

  const saveRelocation = async () => {
    if (!relocation || !target) return;

    const targetId = target.id;
    const done =
      relocation.kind === "merge"
        ? targetId !== null &&
          (await run("merge", () => merge.mutateAsync({ sourceId: item.id, targetId })))
        : await run("move-alias", () =>
            moveAlias.mutateAsync({ aliasId: relocation.aliasId, targetId })
          );

    if (done) relocate(null);
  };

  const saveAlias = async () => {
    const text = alias.trim();

    if (!text) return;
    if (await run("add-alias", () => addAlias.mutateAsync({ ingredientId: item.id, text }))) {
      setAlias("");
    }
  };

  return (
    <li
      className="bg-surface-secondary flex flex-col gap-3 rounded-lg p-3"
      data-flagged={item.flagged}
      data-ingredient={item.name}
      data-testid="ingredient-row"
    >
      <div className="flex items-center gap-2">
        {renaming ? (
          <TextField
            aria-label={t("rename")}
            className="min-w-0 flex-1"
            value={name}
            onChange={setName}
          >
            <Input
              ref={nameField}
              data-testid="ingredient-name-input"
              variant="secondary"
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveName();
                if (event.key === "Escape") setRenaming(false);
              }}
            />
          </TextField>
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
        )}

        {item.flagged && !renaming ? (
          <Chip color="warning" data-testid="ingredient-flagged" size="sm" variant="soft">
            {t("flagged")}
          </Chip>
        ) : null}

        {renaming ? (
          <>
            <IconActionButton
              action="save"
              isDisabled={busy}
              label={tActions("save")}
              size="sm"
              onPress={() => void saveName()}
            />
            <IconActionButton
              action="cancel"
              label={tActions("cancel")}
              size="sm"
              onPress={() => {
                setName(item.name);
                setRenaming(false);
              }}
            />
          </>
        ) : item.canEdit ? (
          <>
            {item.flagged ? (
              <Button
                data-testid="ingredient-mark-distinct"
                isDisabled={busy}
                size="sm"
                variant="tertiary"
                onPress={() =>
                  void run("mark-distinct", () =>
                    markDistinct.mutateAsync({ ingredientId: item.id })
                  )
                }
              >
                {t("markDistinct")}
              </Button>
            ) : null}
            <Button
              data-testid="ingredient-merge"
              isDisabled={busy}
              size="sm"
              variant="tertiary"
              onPress={() => relocate({ kind: "merge" })}
            >
              {t("mergeInto")}
            </Button>
            <IconActionButton
              action="edit"
              data-testid="ingredient-rename"
              label={t("rename")}
              size="sm"
              onPress={() => {
                setName(item.name);
                setRenaming(true);
              }}
            />
          </>
        ) : null}
      </div>

      {relocation ? (
        <div className="flex flex-col gap-2" data-testid="ingredient-relocation">
          <span className="text-muted text-sm">
            {relocation.kind === "merge"
              ? t("mergeTitle", { name: item.name })
              : t("moveTitle", { alias: relocation.text })}
          </span>
          <div className="flex items-center gap-2">
            <IngredientPicker
              allowNew={relocation.kind === "move"}
              editableOnly={relocation.kind === "merge"}
              excludeId={item.id}
              label={relocation.kind === "merge" ? t("mergeInto") : t("moveTo")}
              onPick={setTarget}
            />
            <Button
              data-testid="ingredient-relocation-confirm"
              isDisabled={busy || !target}
              size="sm"
              onPress={() => void saveRelocation()}
            >
              {relocation.kind === "merge" ? t("merge") : t("move")}
            </Button>
            <IconActionButton
              action="cancel"
              label={tActions("cancel")}
              size="sm"
              onPress={() => relocate(null)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        {item.aliases.map((spelling) => (
          <Chip key={spelling.id} data-testid="ingredient-alias" size="sm" variant="tertiary">
            {spelling.text}
            {spelling.canRemove ? (
              <button
                aria-label={t("moveAlias", { alias: spelling.text })}
                className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                data-testid="ingredient-alias-move"
                type="button"
                onClick={() =>
                  relocate({ kind: "move", aliasId: spelling.id, text: spelling.text })
                }
              >
                <ArrowRightIcon className="size-3" />
              </button>
            ) : null}
            {spelling.canRemove ? (
              <button
                aria-label={t("removeAlias", { alias: spelling.text })}
                className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                type="button"
                onClick={() =>
                  void run("remove-alias", () => removeAlias.mutateAsync({ aliasId: spelling.id }))
                }
              >
                <XMarkIcon className="size-3" />
              </button>
            ) : null}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TextField
          aria-label={t("addAlias")}
          className="min-w-0 flex-1 sm:max-w-xs"
          value={alias}
          onChange={setAlias}
        >
          <Input
            data-testid="ingredient-alias-input"
            placeholder={t("addAlias")}
            variant="secondary"
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveAlias();
            }}
          />
        </TextField>
        <IconActionButton
          action="add"
          isDisabled={busy || !alias.trim()}
          label={t("addAlias")}
          size="sm"
          variant="tertiary"
          onPress={() => void saveAlias()}
        />
      </div>
    </li>
  );
}
