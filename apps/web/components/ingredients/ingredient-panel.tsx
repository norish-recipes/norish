"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { OnTheListMark } from "@/components/groceries/pantry/put-on-the-list";
import Panel from "@/components/Panel/Panel";
import { ActionButton, IconActionButton } from "@/components/shared/action-button";
import { AIButton } from "@/components/shared/ai-button";
import UiSwitch from "@/components/shared/ui-switch";
import { usePermissionsContext } from "@/context/permissions-context";
import { useSpellingRules } from "@/hooks/config";
import { useGroceriesQuery } from "@/hooks/groceries";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button, Chip, Input, TextField, toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import type {
  CatalogueRefusal,
  ReviewOutcome,
} from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { isCatalogueRefusal } from "@norish/shared/contracts/ingredient-catalogue";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { groceryOnTheList } from "@norish/shared/lib/pantry";

import type { IngredientPick } from "./ingredient-picker";
import type { Relocation } from "./ingredient-relocation";
import type { IngredientItem, Spelling } from "./types";
import { DeleteIngredientModal } from "./delete-ingredient-modal";
import { IngredientNutritionSection } from "./ingredient-nutrition";
import { IngredientRelocationPanel } from "./ingredient-relocation";
import { IngredientStatusChip } from "./ingredient-status-chip";
import { reviewMessage, reviewTrace, suggestionMessage, suggestionTrace } from "./review-copy";
import { useIngredientCache } from "./use-ingredient-cache";
import { useIngredientSuggestions } from "./use-ingredient-suggestions";

/** Why the server refused an edit, as the procedures name it. */
function refusalOf(error: unknown): CatalogueRefusal | null {
  const message = error instanceof Error ? error.message : null;

  return isCatalogueRefusal(message) ? message : null;
}

/** The parent as the draft holds it: the food picked, or none. */
type DraftParent = { id: string; name: string; localeNames?: LocaleNames } | null;

/**
 * One Ingredient, opened: its name, what it is a kind of, the spellings it
 * goes by, and every edit the server says the viewer may make. The name,
 * the parent and the spellings are a draft the panel holds until Save, as
 * every other panel does; nothing lands on its own. What names another
 * Ingredient (a merge, a parent, a spelling's move) is picked in a second
 * panel over this one: a parent joins the draft, a merge or a move is an
 * action of its own with its own confirm. A flagged food says why at the
 * top, with the two ways to settle it. What AI suggests waits on the viewer:
 * a parent is filled into the draft, marked as AI's, and lands with Save or
 * is dismissed; a merge or "a food of its own" is a notice at the top to
 * confirm or dismiss. Every other field stays the viewer's to edit. The
 * panel follows the item it was opened for through the list, and reads it on
 * its own once the list no longer lists it, so its own edit, a housemate's or
 * AI's shows here too. Every edit shows the moment it is made: the row and
 * the panel change as the server will change them, and a refusal puts them
 * back and says why.
 */
export function IngredientPanel({
  id = null,
  item,
  open,
  nested = false,
  reviewing = false,
  onClose,
  onChanged,
}: {
  /** The food the panel is open for, which a link may name before the list lists it. */
  id?: string | null;
  /** The food as the list now has it; null while the list does not list it. */
  item: IngredientItem | null;
  open: boolean;
  /** Opened from another panel, over it: closing comes back to that one. */
  nested?: boolean;
  /** A round of Ask AI is asking about this food: nothing is edited meanwhile. */
  reviewing?: boolean;
  onClose: () => void;
  /** An edit landed: the opener reads what it lists again. */
  onChanged?: () => void;
}) {
  const locale = useLocale();
  const trpc = useTRPC();
  // The last food the panel had stays on screen while the panel slides away.
  const [shown, setShown] = useState<IngredientItem | null>(item);
  // A food a filter or a search no longer lists (marked distinct under
  // "flagged only", say) is read on its own, so the panel keeps up with it.
  // The food asked for comes first: a link to another food reads that one,
  // not the one the panel showed last. With no food asked for (the panel
  // closing), the last one stays.
  const ownId = id ?? shown?.id ?? null;
  const own = useQuery({
    ...trpc.ingredients.get.queryOptions({ ingredientId: ownId ?? "", locale }),
    enabled: open && ownId !== null && item === null,
  });
  const current: IngredientItem | null = item ?? own.data ?? null;

  useEffect(() => {
    if (current) setShown(current);
  }, [current]);

  // Another food asked for, not read yet: nothing, rather than the last one.
  if (!shown || (open && id !== null && shown.id !== id && !current)) return null;

  return (
    <IngredientPanelContent
      // Another food is another panel: its fields start from that food.
      key={shown.id}
      item={shown}
      nested={nested}
      open={open}
      reviewing={reviewing}
      onChanged={onChanged}
      onClose={onClose}
    />
  );
}

function IngredientPanelContent({
  item,
  open,
  nested,
  reviewing,
  onClose,
  onChanged,
}: {
  item: IngredientItem;
  open: boolean;
  nested: boolean;
  reviewing: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const locale = useLocale();
  const trpc = useTRPC();
  const cache = useIngredientCache();
  const displayName = ingredientDisplayName(item, locale);
  const [allSpellings, setAllSpellings] = useState(false);
  // The catalogue knows a food in dozens of languages; the server sends the
  // viewer's spellings and a person's own, and the rest are fetched when the
  // panel is asked for them.
  const hiddenSpellings = item.hiddenSpellings ?? 0;
  const allSpellingsQuery = useQuery({
    ...trpc.ingredients.spellings.queryOptions({ ingredientId: item.id }),
    enabled: allSpellings && hiddenSpellings > 0,
  });
  const everySpelling: Spelling[] = allSpellingsQuery.data ?? item.aliases;

  // The draft: what the viewer has changed and not yet saved.
  const [name, setName] = useState(item.name);
  const [parent, setParent] = useState<DraftParent>(item.parent);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  // What the row counts: every spelling the food has, and the draft's changes to them.
  const spellingCount = item.aliases.length + hiddenSpellings + added.length - removed.size;
  const [alias, setAlias] = useState("");
  const [relocation, setRelocation] = useState<Relocation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const suggestions = useIngredientSuggestions();
  const suggestion = suggestions.suggestions.find((it) => it.ingredient.id === item.id) ?? null;
  // A parent AI proposes is a draft to save; one the words of the name gave
  // is already in place, and is confirmed or dismissed like a merge.
  const suggestedParent =
    suggestion?.kind === "parent" && suggestion.source === "ai" ? suggestion.target : null;
  const { isAIEnabled } = usePermissionsContext();

  // Whether the household keeps the food, and the draft's say on it (null: untouched).
  const tPantry = useTranslations("groceries.pantry");
  const tGroceries = useTranslations("groceries.page");
  const { items: pantry } = usePantryQuery();
  const { addPantryIngredient, removePantryIngredient } = usePantryMutations();
  const kept = pantry.find((held) => held.ingredientId === item.id) ?? null;
  const [keeps, setKeeps] = useState<boolean | null>(null);

  // A refused save is read back from the server, which would overwrite the
  // draft the viewer still has to fix: that one read leaves the draft alone.
  const keepDraft = useRef(false);

  // A change elsewhere (a housemate's, or AI's) shows in the draft where the
  // viewer has not touched that field; a parent AI suggests fills the draft,
  // for the viewer to keep with Save or dismiss.
  useEffect(() => {
    if (keepDraft.current) {
      keepDraft.current = false;

      return;
    }
    setName(item.name);
    setParent(suggestedParent ?? item.parent);
  }, [item.name, item.parent, suggestedParent]);

  const saveDraft = useMutation(trpc.ingredients.saveDraft.mutationOptions());
  const markDistinct = useMutation(trpc.ingredients.markDistinct.mutationOptions());
  const merge = useMutation(trpc.ingredients.merge.mutationOptions());
  const moveAlias = useMutation(trpc.ingredients.moveAlias.mutationOptions());
  const remove = useMutation(trpc.ingredients.remove.mutationOptions());
  const review = useMutation(trpc.ingredients.reviewWithAI.mutationOptions());
  const findParent = useMutation(trpc.ingredients.findParentWithAI.mutationOptions());
  // AI is asking about this food, from here or in a round: its answer is
  // about the food as it stands, so nothing is edited until it lands. An
  // edit of the viewer's own never waits: it shows at once and lands behind.
  const asking = review.isPending || findParent.isPending || reviewing;
  const busy = asking;

  /**
   * Make an edit: `show` changes the cache as the server will, now; `edit`
   * is the server's turn, after which everything is read again. A refusal
   * reads everything again too, which undoes what was shown, and says why.
   */
  const run = async (context: string, show: () => void, edit: () => Promise<unknown>) => {
    try {
      show();
      await edit();
      onChanged?.();

      return true;
    } catch (error) {
      void cache.rollback();
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

  // The draft's parent is AI's suggestion, not yet saved.
  const parentIsSuggested =
    suggestedParent !== null &&
    parent?.id === suggestedParent.id &&
    item.parent?.id !== suggestedParent.id;
  const nextName = name.trim();
  const nameChanged = nextName !== "" && nextName !== item.name;
  const parentChanged = (parent?.id ?? null) !== (item.parent?.id ?? null);
  const catalogueDirty = nameChanged || parentChanged || added.length > 0 || removed.size > 0;
  const pantryChanged = keeps !== null && keeps !== (kept !== null);
  const dirty = catalogueDirty || pantryChanged;

  /**
   * Land the draft: the Pantry switch, which is the household's and open to
   * any member, and the catalogue fields as one edit; a refusal of those
   * changes nothing, keeps them in the draft and says why.
   */
  const save = async () => {
    if (!dirty || busy) return;
    if (pantryChanged) {
      if (kept) removePantryIngredient(kept.id);
      else
        void addPantryIngredient({
          ingredientId: item.id,
          name: item.name,
          localeNames: item.localeNames,
        }).catch(() => toast(tPantry("keepFailed", { name: displayName }), { variant: "danger" }));
      setKeeps(null);
    }
    if (!catalogueDirty) return;
    const draft = { added, removed, parent };

    // The row reads as the draft has it, and the draft is spent, at once.
    setAdded([]);
    setRemoved(new Set());
    const saved = await run(
      "save",
      () =>
        cache.patchRow(item.id, (row) => ({
          ...row,
          ...(nameChanged ? { name: nextName } : {}),
          ...(parentChanged ? { parent: parent ? { ...parent } : null } : {}),
          // A flagged food the viewer saved by hand is settled by it.
          ...(parentChanged && parent ? { flagged: false, flagReason: null } : {}),
          aliases: [
            ...row.aliases.filter((spelling) => !removed.has(spelling.id)),
            ...added.map((text) => ({ id: `draft:${text}`, text, canRemove: true })),
          ],
        })),
      () =>
        saveDraft.mutateAsync({
          ingredientId: item.id,
          ...(nameChanged ? { name: nextName } : {}),
          ...(parentChanged ? { parentId: parent?.id ?? null } : {}),
          add: added,
          remove: [...removed],
        })
    );

    // A refused draft is the viewer's to fix, so it comes back as it was.
    if (!saved) {
      keepDraft.current = true;
      setAdded(draft.added);
      setRemoved(draft.removed);
      setName(nextName);
      setParent(draft.parent);
    }
  };

  /** A spelling typed joins the draft; the field clears for the next. */
  const stageAlias = () => {
    const text = alias.trim();

    if (!text) return;
    if (!added.includes(text)) setAdded((current) => [...current, text]);
    setAlias("");
  };

  const saveRelocation = (asked: Relocation, target: IngredientPick) => {
    if (asked.kind === "parent") {
      // A parent joins the draft and lands with Save.
      if (target.id !== null) setParent(target);
      setRelocation(null);

      return;
    }
    const targetId = target.id;

    setRelocation(null);
    if (asked.kind === "move") {
      void run(
        "move-alias",
        () =>
          cache.patchRow(item.id, (row) => ({
            ...row,
            aliases: row.aliases.filter((spelling) => spelling.id !== asked.aliasId),
          })),
        () => moveAlias.mutateAsync({ aliasId: asked.aliasId, targetId })
      );

      return;
    }
    if (targetId === null) return;
    // Merged away, the food is gone: nothing is left to show for it. The
    // toast says where it went and how to get it back.
    onClose();
    toast(t("mergedToast", { name: displayName, into: target.name }), { variant: "success" });
    void run(
      "merge",
      () => cache.dropRow(item.id),
      () => merge.mutateAsync({ sourceId: item.id, targetId })
    );
  };

  const confirmDelete = () => {
    setDeleting(false);
    onClose();
    void run(
      "delete",
      () => cache.dropRow(item.id),
      () => remove.mutateAsync({ ingredientId: item.id })
    );
  };

  /** Take AI's suggestion, or leave it; a merge takes the food away, as the viewer's own does. */
  const answerSuggestion = (confirm: boolean) => {
    if (!suggestion) return;
    if (!confirm) {
      // A dismissed parent leaves the draft as the suggestion goes.
      void suggestions.dismiss([suggestion.id]);

      return;
    }
    void suggestions.confirm([suggestion.id]);
    if (suggestion.kind === "merge") {
      onClose();
      if (suggestion.target) {
        toast(
          t("mergedToast", {
            name: displayName,
            into: ingredientDisplayName(suggestion.target, locale),
          }),
          { variant: "success" }
        );
      }
    }
  };

  /** Ask AI what this food is, and say what it suggests. */
  const askAI = async () => {
    await run(
      "review",
      () => undefined,
      async () => {
        const outcome: ReviewOutcome = await review.mutateAsync({ ingredientId: item.id });

        toast(reviewMessage(t, displayName, outcome), {
          description: reviewTrace(t, outcome),
          variant: outcome.outcome === "unsure" ? "warning" : "accent",
        });
      }
    );
  };

  /** Ask AI what food this is a kind of, and say what it suggests. */
  const askParent = async () => {
    await run(
      "find-parent",
      () => undefined,
      async () => {
        const outcome: ReviewOutcome = await findParent.mutateAsync({ ingredientId: item.id });

        toast(reviewMessage(t, displayName, outcome), {
          description: reviewTrace(t, outcome),
          variant: outcome.outcome === "parent" ? "accent" : "warning",
        });
      }
    );
  };

  /**
   * One spelling the food goes by. One the viewer may edit is a button: the
   * chip itself moves the spelling to another food, the cross removes it.
   */
  const spellingChip = (spelling: Spelling) => {
    const pendingRemoval = removed.has(spelling.id);

    return (
      <Chip
        key={spelling.id}
        className={pendingRemoval ? "line-through opacity-60" : undefined}
        data-pending={pendingRemoval ? "removed" : undefined}
        data-testid="ingredient-alias"
        size="sm"
        variant="tertiary"
      >
        {spelling.canRemove && !pendingRemoval ? (
          <button
            aria-label={t("moveAlias", { alias: spelling.text })}
            className="hover:text-foreground cursor-[var(--cursor-interactive)]"
            data-testid="ingredient-alias-move"
            disabled={busy}
            type="button"
            onClick={() =>
              setRelocation({ kind: "move", aliasId: spelling.id, text: spelling.text })
            }
          >
            {spelling.text}
          </button>
        ) : (
          spelling.text
        )}
        {spelling.canRemove ? (
          <button
            aria-label={
              pendingRemoval
                ? t("keepAlias", { alias: spelling.text })
                : t("removeAlias", { alias: spelling.text })
            }
            className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
            data-testid="ingredient-alias-remove"
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
      className={nested ? "contents" : undefined}
      nested={nested}
      open={open}
      title={displayName}
      titleAddon={<IngredientStatusChip flagged={item.flagged} reviewing={asking} />}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="ingredient-details">
          {suggestion && (suggestion.kind !== "parent" || suggestion.source === "words") ? (
            <Section
              title={suggestion.source === "words" ? t("suggestedFromName") : t("suggestedByAI")}
            >
              <div
                className="flex flex-col gap-2"
                data-source={suggestion.source}
                data-testid="ingredient-suggestion-notice"
              >
                <p className="text-sm font-medium">{suggestionMessage(t, suggestion, locale)}</p>
                {suggestion.source === "ai" ? (
                  <p className="text-muted text-sm">{suggestionTrace(t, suggestion)}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    data-testid="ingredient-suggestion-confirm"
                    isDisabled={busy}
                    size="sm"
                    variant="secondary"
                    onPress={() => answerSuggestion(true)}
                  >
                    {t("confirmSuggestion")}
                  </Button>
                  <Button
                    data-testid="ingredient-suggestion-dismiss"
                    isDisabled={busy}
                    size="sm"
                    variant="danger-soft"
                    onPress={() => answerSuggestion(false)}
                  >
                    {t("dismissSuggestion")}
                  </Button>
                </div>
              </div>
            </Section>
          ) : null}
          {item.flagged ? (
            <div className="flex flex-col gap-3" data-testid="ingredient-flag-notice">
              <p className="text-muted text-sm" data-testid="ingredient-flag-reason">
                {t(`flagReasons.${item.flagReason ?? "unknown"}`)}
              </p>
              {item.canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  {isAIEnabled ? (
                    <AIButton
                      data-testid="ingredient-ask-ai"
                      isDisabled={busy}
                      isPending={review.isPending || reviewing}
                      size="sm"
                      variant="secondary"
                      onPress={() => void askAI()}
                    >
                      {t("askAI")}
                    </AIButton>
                  ) : null}
                  <Button
                    data-testid="ingredient-mark-distinct"
                    isDisabled={busy}
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      void run(
                        "mark-distinct",
                        () =>
                          cache.patchRow(item.id, (row) => ({
                            ...row,
                            flagged: false,
                            flagReason: null,
                          })),
                        () => markDistinct.mutateAsync({ ingredientId: item.id })
                      )
                    }
                  >
                    {t("markDistinct")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <Section title={t("nameSection")}>
            {item.canEdit ? (
              <TextField
                aria-label={t("rename")}
                className="min-w-0"
                isDisabled={busy}
                value={name}
                onChange={setName}
              >
                <Input
                  data-testid="ingredient-name-input"
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
            {displayName !== item.name ? (
              <p className="text-muted text-sm">{t("shownAs", { name: displayName })}</p>
            ) : null}
          </Section>

          <Section title={tGroceries("pantry")}>
            <PantryRow
              keeping={keeps ?? kept !== null}
              kept={kept}
              onKeepingChange={(on) => setKeeps(on === (kept !== null) ? null : on)}
            />
          </Section>

          <Section title={t("parentSection")}>
            <div className="flex flex-wrap items-center gap-2" data-testid="ingredient-parent">
              {parent ? (
                // The same height as the button beside it: the pair reads as one row.
                <Chip
                  className="h-9 px-3 text-sm md:h-8"
                  color={parentIsSuggested ? "accent" : undefined}
                  data-suggested={parentIsSuggested || undefined}
                  size="lg"
                  variant={parentIsSuggested ? "soft" : "secondary"}
                >
                  {ingredientDisplayName(parent, locale)}
                  {item.canEdit ? (
                    <button
                      aria-label={parentIsSuggested ? t("dismissSuggestion") : t("clearParent")}
                      className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                      data-testid="ingredient-clear-parent"
                      disabled={busy}
                      type="button"
                      onClick={() =>
                        parentIsSuggested ? answerSuggestion(false) : setParent(null)
                      }
                    >
                      <XMarkIcon className="size-4" />
                    </button>
                  ) : null}
                </Chip>
              ) : null}
              {parentIsSuggested ? (
                <span className="text-muted text-xs" data-testid="ingredient-parent-suggested">
                  {t("suggestedByAI")}
                </span>
              ) : null}
              {item.canEdit ? (
                <Button
                  data-testid="ingredient-set-parent"
                  isDisabled={busy}
                  size="sm"
                  variant="secondary"
                  onPress={() => setRelocation({ kind: "parent" })}
                >
                  <PencilSquareIcon className="size-4" />
                  {parent ? t("changeParent") : t("setParent")}
                </Button>
              ) : null}
              {isAIEnabled && item.canEdit && !item.parent ? (
                <AIButton
                  data-testid="ingredient-find-parent"
                  isDisabled={busy}
                  isPending={findParent.isPending}
                  size="sm"
                  variant="secondary"
                  onPress={() => void askParent()}
                >
                  {t("findParent")}
                </AIButton>
              ) : null}
            </div>
          </Section>

          <Section title={t("spellingsSection")}>
            <Button
              fullWidth
              className="justify-between"
              data-testid="ingredient-all-spellings"
              variant="tertiary"
              onPress={() => setAllSpellings(true)}
            >
              {t("spellingsCount", { count: spellingCount })}
              <ChevronRightIcon className="size-4" />
            </Button>
          </Section>

          <IngredientNutritionSection ingredientId={item.id} name={displayName} />
        </div>
      </Panel.Body>

      <Panel.Footer>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {item.canEdit ? (
            <ActionButton
              action="delete"
              data-testid="ingredient-delete"
              isDisabled={busy}
              onPress={() => setDeleting(true)}
            >
              {t("delete")}
            </ActionButton>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {item.canEdit ? (
              <Button
                data-testid="ingredient-merge"
                isDisabled={busy}
                variant="secondary"
                onPress={() => setRelocation({ kind: "merge" })}
              >
                <ArrowRightIcon className="size-4" />
                {t("mergeInto")}
              </Button>
            ) : null}
            <ActionButton
              action="save"
              data-testid="ingredient-save"
              isDisabled={busy || !dirty}
              onPress={() => void save()}
            >
              {tActions("save")}
            </ActionButton>
          </div>
        </div>
      </Panel.Footer>

      <Panel
        nested
        className="contents"
        open={allSpellings}
        title={t("spellingsSection")}
        onOpenChange={(isOpen) => {
          if (!isOpen) setAllSpellings(false);
        }}
      >
        <Panel.Body>
          <div className="flex flex-col gap-3">
            <div
              className="flex flex-wrap items-center gap-1"
              data-testid="ingredient-spellings-all"
            >
              {everySpelling.map(spellingChip)}
              {added.map((text) => (
                <Chip
                  key={`new-${text}`}
                  color="accent"
                  data-pending="added"
                  data-testid="ingredient-alias"
                  size="sm"
                  variant="soft"
                >
                  {text}
                  <button
                    aria-label={t("removeAlias", { alias: text })}
                    className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                    data-testid="ingredient-alias-remove"
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
                  data-testid="ingredient-alias-input"
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
        </Panel.Body>
        <Panel.Footer>
          <Button className="ml-auto" variant="tertiary" onPress={() => setAllSpellings(false)}>
            {tActions("done")}
          </Button>
        </Panel.Footer>
      </Panel>

      <IngredientRelocationPanel
        busy={busy}
        ingredient={item}
        relocation={relocation}
        onClose={() => setRelocation(null)}
        onConfirm={saveRelocation}
      />

      <DeleteIngredientModal
        isOpen={deleting}
        name={displayName}
        onClose={() => setDeleting(false)}
        onConfirm={confirmDelete}
      />
    </Panel>
  );
}

/**
 * Whether the household keeps this food. The switch is part of the draft and
 * lands with Save, open to any member whatever the edit policy says, since
 * keeping a food is a household matter. It reflects the food itself only; a
 * kept kind of it does not turn it on. A kept food whose grocery is still to
 * buy says so; putting it on the list is the Pantry page's.
 */
function PantryRow({
  kept,
  keeping,
  onKeepingChange,
}: {
  kept: PantryIngredientDto | null;
  keeping: boolean;
  onKeepingChange: (keeping: boolean) => void;
}) {
  const t = useTranslations("groceries.pantry");
  const rules = useSpellingRules();
  const { groceries } = useGroceriesQuery();

  return (
    <div
      className="flex min-h-9 flex-wrap items-center justify-between gap-3"
      data-testid="ingredient-pantry"
    >
      <UiSwitch isSelected={keeping} onValueChange={onKeepingChange}>
        <span className="text-sm">{t("inYourPantry")}</span>
      </UiSwitch>
      {kept && keeping && groceryOnTheList(groceries, kept, rules) ? <OnTheListMark /> : null}
    </div>
  );
}

/** One part of the panel: a small heading over what it holds. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}
