"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import { ActionButton, IconActionButton } from "@/components/shared/action-button";
import { AIButton } from "@/components/shared/ai-button";
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

import type {
  CatalogueRefusal,
  ReviewOutcome,
} from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { isCatalogueRefusal } from "@norish/shared/contracts/ingredient-catalogue";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { IngredientPick } from "./ingredient-picker";
import type { Relocation } from "./ingredient-relocation";
import type { IngredientItem, Spelling } from "./ingredient-row";
import { DeleteIngredientModal } from "./delete-ingredient-modal";
import { IngredientRelocationPanel } from "./ingredient-relocation";
import { IngredientStatusChip } from "./ingredient-status-chip";
import { reviewMessage, reviewTrace, suggestionMessage } from "./review-copy";
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
 * AI's shows here too.
 */
export function IngredientPanel({
  item,
  open,
  reviewing = false,
  onClose,
  onChanged,
}: {
  /** The food as the list now has it; null while the list does not list it. */
  item: IngredientItem | null;
  open: boolean;
  /** A round of Ask AI is asking about this food: nothing is edited meanwhile. */
  reviewing?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const locale = useLocale();
  const trpc = useTRPC();
  // The last food the panel had stays on screen while the panel slides away.
  const [shown, setShown] = useState<IngredientItem | null>(item);
  // A food a filter or a search no longer lists (marked distinct under
  // "flagged only", say) is read on its own, so the panel keeps up with it.
  const own = useQuery({
    ...trpc.ingredients.get.queryOptions({ ingredientId: shown?.id ?? "", locale }),
    enabled: open && shown !== null && item === null,
  });
  const current: IngredientItem | null = item ?? own.data ?? null;

  useEffect(() => {
    if (current) setShown(current);
  }, [current]);

  if (!shown) return null;

  return (
    <IngredientPanelContent
      // Another food is another panel: its fields start from that food.
      key={shown.id}
      item={shown}
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
  reviewing,
  onClose,
  onChanged,
}: {
  item: IngredientItem;
  open: boolean;
  reviewing: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const locale = useLocale();
  const trpc = useTRPC();
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
  const suggestedParent = suggestion?.kind === "parent" ? suggestion.target : null;

  // A change elsewhere (a housemate's, or AI's) shows in the draft where the
  // viewer has not touched that field.
  useEffect(() => {
    setName(item.name);
  }, [item.name]);
  // A parent AI suggests fills the draft, for the viewer to keep with Save or dismiss.
  useEffect(() => {
    setParent(suggestedParent ?? item.parent);
  }, [item.parent, suggestedParent]);

  const saveDraft = useMutation(trpc.ingredients.saveDraft.mutationOptions());
  const markDistinct = useMutation(trpc.ingredients.markDistinct.mutationOptions());
  const merge = useMutation(trpc.ingredients.merge.mutationOptions());
  const moveAlias = useMutation(trpc.ingredients.moveAlias.mutationOptions());
  const remove = useMutation(trpc.ingredients.remove.mutationOptions());
  const review = useMutation(trpc.ingredients.reviewWithAI.mutationOptions());
  const findParent = useMutation(trpc.ingredients.findParentWithAI.mutationOptions());
  // AI is asking about this food, from here or in a round: its answer is
  // about the food as it stands, so nothing is edited until it lands.
  const asking = review.isPending || findParent.isPending || reviewing;
  // One edit at a time: a second one on the same food races the first.
  const busy =
    asking ||
    [saveDraft, markDistinct, merge, moveAlias, remove].some((mutation) => mutation.isPending) ||
    suggestions.isAnswering;

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

  // The draft's parent is AI's suggestion, not yet saved.
  const parentIsSuggested =
    suggestedParent !== null &&
    parent?.id === suggestedParent.id &&
    item.parent?.id !== suggestedParent.id;
  const nextName = name.trim();
  const nameChanged = nextName !== "" && nextName !== item.name;
  const parentChanged = (parent?.id ?? null) !== (item.parent?.id ?? null);
  const dirty = nameChanged || parentChanged || added.length > 0 || removed.size > 0;

  /** Land the draft as one edit; a refusal changes nothing, keeps the draft and says why. */
  const save = async () => {
    if (!dirty || busy) return;
    const saved = await run("save", () =>
      saveDraft.mutateAsync({
        ingredientId: item.id,
        ...(nameChanged ? { name: nextName } : {}),
        ...(parentChanged ? { parentId: parent?.id ?? null } : {}),
        add: added,
        remove: [...removed],
      })
    );

    if (saved) {
      setAdded([]);
      setRemoved(new Set());
    }
  };

  /** A spelling typed joins the draft; the field clears for the next. */
  const stageAlias = () => {
    const text = alias.trim();

    if (!text) return;
    if (!added.includes(text)) setAdded((current) => [...current, text]);
    setAlias("");
  };

  const saveRelocation = async (asked: Relocation, target: IngredientPick) => {
    if (asked.kind === "parent") {
      // A parent joins the draft and lands with Save.
      if (target.id !== null) setParent(target);
      setRelocation(null);

      return;
    }
    const targetId = target.id;
    const done =
      asked.kind === "move"
        ? await run("move-alias", () => moveAlias.mutateAsync({ aliasId: asked.aliasId, targetId }))
        : targetId !== null &&
          (await run("merge", () => merge.mutateAsync({ sourceId: item.id, targetId })));

    if (done) {
      setRelocation(null);
      // Merged away, the food is gone: nothing is left to show for it. The
      // toast says where it went and how to get it back.
      if (asked.kind === "merge") {
        onClose();
        if (target.id !== null) {
          toast(t("mergedToast", { name: displayName, into: target.name }), { variant: "success" });
        }
      }
    }
  };

  const confirmDelete = async () => {
    if (await run("delete", () => remove.mutateAsync({ ingredientId: item.id }))) {
      setDeleting(false);
      onClose();
    }
  };

  /** Take AI's suggestion, or leave it; a merge takes the food away, as the viewer's own does. */
  const answerSuggestion = async (confirm: boolean) => {
    if (!suggestion) return;
    if (!confirm) {
      // A dismissed parent leaves the draft as the suggestion goes.
      await suggestions.dismiss([suggestion.id]);

      return;
    }
    if ((await suggestions.confirm([suggestion.id])) && suggestion.kind === "merge") {
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
    await run("review", async () => {
      const outcome: ReviewOutcome = await review.mutateAsync({ ingredientId: item.id });

      toast(reviewMessage(t, displayName, outcome), {
        description: reviewTrace(t, outcome),
        variant: outcome.outcome === "unsure" ? "warning" : "accent",
      });
    });
  };

  /** Ask AI what food this is a kind of, and say what it suggests. */
  const askParent = async () => {
    await run("find-parent", async () => {
      const outcome: ReviewOutcome = await findParent.mutateAsync({ ingredientId: item.id });

      toast(reviewMessage(t, displayName, outcome), {
        description: reviewTrace(t, outcome),
        variant: outcome.outcome === "parent" ? "accent" : "warning",
      });
    });
  };

  /** One spelling the food goes by, with the moves the viewer may make on it. */
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
        {spelling.text}
        {spelling.canRemove && !pendingRemoval ? (
          <button
            aria-label={t("moveAlias", { alias: spelling.text })}
            className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
            data-testid="ingredient-alias-move"
            disabled={busy}
            type="button"
            onClick={() =>
              setRelocation({ kind: "move", aliasId: spelling.id, text: spelling.text })
            }
          >
            <ArrowRightIcon className="size-3" />
          </button>
        ) : null}
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
      open={open}
      title={displayName}
      titleAddon={<IngredientStatusChip flagged={item.flagged} reviewing={asking} />}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="ingredient-details">
          {suggestion && suggestion.kind !== "parent" ? (
            <Section title={t("suggestedByAI")}>
              <div className="flex flex-col gap-2" data-testid="ingredient-suggestion-notice">
                <p className="text-sm font-medium">{suggestionMessage(t, suggestion, locale)}</p>
                <p className="text-muted text-sm">{reviewTrace(t, suggestion)}</p>
                {suggestion.canAnswer ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      data-testid="ingredient-suggestion-confirm"
                      isDisabled={busy}
                      size="sm"
                      variant="secondary"
                      onPress={() => void answerSuggestion(true)}
                    >
                      {t("confirmSuggestion")}
                    </Button>
                    <Button
                      data-testid="ingredient-suggestion-dismiss"
                      isDisabled={busy}
                      size="sm"
                      variant="ghost"
                      onPress={() => void answerSuggestion(false)}
                    >
                      {t("dismissSuggestion")}
                    </Button>
                  </div>
                ) : null}
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
                  <Button
                    data-testid="ingredient-mark-distinct"
                    isDisabled={busy}
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      void run("mark-distinct", () =>
                        markDistinct.mutateAsync({ ingredientId: item.id })
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

          <Section title={t("parentSection")}>
            <div className="flex flex-wrap items-center gap-2" data-testid="ingredient-parent">
              {parent ? (
                <Chip
                  color={parentIsSuggested ? "accent" : undefined}
                  data-suggested={parentIsSuggested || undefined}
                  size="sm"
                  variant={parentIsSuggested ? "soft" : "tertiary"}
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
                        parentIsSuggested ? void answerSuggestion(false) : setParent(null)
                      }
                    >
                      <XMarkIcon className="size-3" />
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
              {item.canEdit && !item.parent ? (
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
              isPending={busy}
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
        onConfirm={(asked, target) => void saveRelocation(asked, target)}
      />

      <DeleteIngredientModal
        isDeleting={remove.isPending}
        isOpen={deleting}
        name={displayName}
        onClose={() => setDeleting(false)}
        onConfirm={() => void confirmDelete()}
      />
    </Panel>
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
