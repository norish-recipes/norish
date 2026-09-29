"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import { ActionButton, IconActionButton } from "@/components/shared/action-button";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowRightIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { Button, Chip, Input, TextField, toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import type {
  CatalogueRefusal,
  ReviewOutcome,
} from "@norish/shared/contracts/ingredient-catalogue";
import { isCatalogueRefusal } from "@norish/shared/contracts/ingredient-catalogue";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { IngredientPick } from "./ingredient-picker";
import type { Relocation } from "./ingredient-relocation";
import type { IngredientItem, Spelling } from "./ingredient-row";
import { DeleteIngredientModal } from "./delete-ingredient-modal";
import { IngredientRelocationPanel } from "./ingredient-relocation";

/** Why the server refused an edit, as the procedures name it. */
function refusalOf(error: unknown): CatalogueRefusal | null {
  const message = error instanceof Error ? error.message : null;

  return isCatalogueRefusal(message) ? message : null;
}

/**
 * One Ingredient, opened: its name, what it is a kind of, the spellings it
 * goes by, and every edit the server says the viewer may make — each edit
 * saved on its own, as it is made, so the panel never holds an unsaved
 * form. Where an edit names another Ingredient (a merge, a parent, a
 * spelling's move) a second panel opens over this one to pick it. A flagged
 * food says why at the top, with the two ways to settle it. The panel
 * follows the item it was opened for through the list, so a housemate's
 * merge or a refresh shows here too, and closes once the item is gone.
 */
export function IngredientPanel({
  item,
  open,
  onClose,
  onChanged,
}: {
  /** The food as the list now has it; null while the list does not list it. */
  item: IngredientItem | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  // The last item the list had stays on screen: while the panel slides away,
  // and while a filter or a search no longer lists the food.
  const [shown, setShown] = useState<IngredientItem | null>(item);

  useEffect(() => {
    if (item) setShown(item);
  }, [item]);

  if (!shown) return null;

  return (
    <IngredientPanelContent
      // Another food is another panel: its fields start from that food.
      key={shown.id}
      item={shown}
      open={open}
      onChanged={onChanged}
      onClose={onClose}
    />
  );
}

function IngredientPanelContent({
  item,
  open,
  onClose,
  onChanged,
}: {
  item: IngredientItem;
  open: boolean;
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
  const spellings: Spelling[] = allSpellings
    ? (allSpellingsQuery.data ?? item.aliases)
    : item.aliases;
  const [name, setName] = useState(item.name);
  const [alias, setAlias] = useState("");
  const [relocation, setRelocation] = useState<Relocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A rename elsewhere (a housemate's, or AI's) shows in the field.
  useEffect(() => {
    setName(item.name);
  }, [item.name]);

  const rename = useMutation(trpc.ingredients.rename.mutationOptions());
  const markDistinct = useMutation(trpc.ingredients.markDistinct.mutationOptions());
  const addAlias = useMutation(trpc.ingredients.addAlias.mutationOptions());
  const removeAlias = useMutation(trpc.ingredients.removeAlias.mutationOptions());
  const merge = useMutation(trpc.ingredients.merge.mutationOptions());
  const moveAlias = useMutation(trpc.ingredients.moveAlias.mutationOptions());
  const setParent = useMutation(trpc.ingredients.setParent.mutationOptions());
  const remove = useMutation(trpc.ingredients.remove.mutationOptions());
  const review = useMutation(trpc.ingredients.reviewWithAI.mutationOptions());
  // One edit at a time: a second one on the same food races the first.
  const busy = [
    rename,
    markDistinct,
    addAlias,
    removeAlias,
    merge,
    moveAlias,
    setParent,
    remove,
    review,
  ].some((mutation) => mutation.isPending);

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

  const nameChanged = name.trim() !== "" && name.trim() !== item.name;

  const saveName = async () => {
    const next = name.trim();

    if (!next || next === item.name) {
      setName(item.name);

      return;
    }
    await run("rename", () => rename.mutateAsync({ ingredientId: item.id, name: next }));
  };

  const saveRelocation = async (asked: Relocation, target: IngredientPick) => {
    const targetId = target.id;
    const done =
      asked.kind === "move"
        ? await run("move-alias", () => moveAlias.mutateAsync({ aliasId: asked.aliasId, targetId }))
        : targetId !== null &&
          (asked.kind === "merge"
            ? await run("merge", () => merge.mutateAsync({ sourceId: item.id, targetId }))
            : await run("set-parent", () =>
                setParent.mutateAsync({ ingredientId: item.id, parentId: targetId })
              ));

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

  const saveAlias = async () => {
    const text = alias.trim();

    if (!text) return;
    if (await run("add-alias", () => addAlias.mutateAsync({ ingredientId: item.id, text }))) {
      setAlias("");
    }
  };

  const confirmDelete = async () => {
    if (await run("delete", () => remove.mutateAsync({ ingredientId: item.id }))) {
      setDeleting(false);
      onClose();
    }
  };

  /** Ask AI what this food is, and say what came of it. */
  const askAI = async () => {
    await run("review", async () => {
      const outcome: ReviewOutcome = await review.mutateAsync({ ingredientId: item.id });

      toast(reviewMessage(t, displayName, outcome), {
        description: reviewTrace(t, outcome),
        variant: outcome.outcome === "unsure" ? "warning" : "success",
      });
    });
  };

  return (
    <Panel
      open={open}
      title={displayName}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="ingredient-details">
          {item.flagged ? (
            <div
              className="border-warning/40 bg-warning/10 flex flex-col gap-3 rounded-xl border p-3"
              data-testid="ingredient-flag-notice"
            >
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon
                  aria-hidden
                  className="text-warning mt-0.5 size-5 shrink-0"
                />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{t("flagged")}</span>
                  <span className="text-muted text-sm" data-testid="ingredient-flag-reason">
                    {t(`flagReasons.${item.flagReason ?? "unknown"}`)}
                  </span>
                </div>
              </div>
              {item.canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    data-testid="ingredient-ask-ai"
                    isDisabled={busy}
                    isPending={review.isPending}
                    size="sm"
                    variant="primary"
                    onPress={() => void askAI()}
                  >
                    <SparklesIcon className="size-4" />
                    {t("askAI")}
                  </Button>
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
              <div className="flex items-center gap-2">
                <TextField
                  aria-label={t("rename")}
                  className="min-w-0 flex-1"
                  value={name}
                  onChange={setName}
                >
                  <Input
                    data-testid="ingredient-name-input"
                    variant="secondary"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveName();
                      if (event.key === "Escape") setName(item.name);
                    }}
                  />
                </TextField>
                <IconActionButton
                  action="save"
                  data-testid="ingredient-rename"
                  isDisabled={busy || !nameChanged}
                  label={tActions("save")}
                  onPress={() => void saveName()}
                />
              </div>
            ) : (
              <p className="font-medium">{item.name}</p>
            )}
            {displayName !== item.name ? (
              <p className="text-muted text-sm">{t("shownAs", { name: displayName })}</p>
            ) : null}
          </Section>

          <Section title={t("parentSection")}>
            {item.parent ? (
              <div className="flex items-center gap-2" data-testid="ingredient-parent">
                <Chip size="sm" variant="tertiary">
                  {t("kindOf", { name: ingredientDisplayName(item.parent, locale) })}
                  {item.canEdit ? (
                    <button
                      aria-label={t("clearParent")}
                      className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                      data-testid="ingredient-clear-parent"
                      disabled={busy}
                      type="button"
                      onClick={() =>
                        void run("set-parent", () =>
                          setParent.mutateAsync({ ingredientId: item.id, parentId: null })
                        )
                      }
                    >
                      <XMarkIcon className="size-3" />
                    </button>
                  ) : null}
                </Chip>
              </div>
            ) : (
              <p className="text-muted text-sm">{t("noParent")}</p>
            )}
            {item.canEdit ? (
              <Button
                className="self-start"
                data-testid="ingredient-set-parent"
                isDisabled={busy}
                size="sm"
                variant="secondary"
                onPress={() => setRelocation({ kind: "parent" })}
              >
                {item.parent ? t("changeParent") : t("setParent")}
              </Button>
            ) : null}
          </Section>

          <Section title={t("spellingsSection")}>
            <div className="flex flex-wrap items-center gap-1">
              {spellings.map((spelling) => (
                <Chip key={spelling.id} data-testid="ingredient-alias" size="sm" variant="tertiary">
                  {spelling.text}
                  {spelling.canRemove ? (
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
                      aria-label={t("removeAlias", { alias: spelling.text })}
                      className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                      disabled={busy}
                      type="button"
                      onClick={() =>
                        void run("remove-alias", () =>
                          removeAlias.mutateAsync({ aliasId: spelling.id })
                        )
                      }
                    >
                      <XMarkIcon className="size-3" />
                    </button>
                  ) : null}
                </Chip>
              ))}
              {hiddenSpellings > 0 ? (
                <Button
                  data-testid="ingredient-all-spellings"
                  isDisabled={allSpellingsQuery.isFetching}
                  size="sm"
                  variant="tertiary"
                  onPress={() => setAllSpellings((shown) => !shown)}
                >
                  {allSpellings
                    ? t("fewerSpellings")
                    : t("moreSpellings", { count: hiddenSpellings })}
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <TextField
                aria-label={t("addAlias")}
                className="min-w-0 flex-1"
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
                variant="tertiary"
                onPress={() => void saveAlias()}
              />
            </div>
          </Section>
        </div>
      </Panel.Body>

      {item.canEdit ? (
        <Panel.Footer>
          <div className="flex w-full items-center justify-between gap-2">
            <ActionButton
              action="delete"
              data-testid="ingredient-delete"
              isDisabled={busy}
              onPress={() => setDeleting(true)}
            >
              {t("delete")}
            </ActionButton>
            <Button
              data-testid="ingredient-merge"
              isDisabled={busy}
              variant="secondary"
              onPress={() => setRelocation({ kind: "merge" })}
            >
              <ArrowRightIcon className="size-4" />
              {t("mergeInto")}
            </Button>
          </div>
        </Panel.Footer>
      ) : null}

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

/** What AI tried, so the viewer can judge its answer: what it read the name as, and what it compared it with. */
function reviewTrace(
  t: ReturnType<typeof useTranslations<"settings.ingredients">>,
  outcome: ReviewOutcome
): string {
  const considered =
    outcome.considered.length > 0
      ? t("aiTrace.compared", { names: outcome.considered.slice(0, 8).join(", ") })
      : t("aiTrace.comparedNothing");

  return outcome.englishName
    ? `${t("aiTrace.readAs", { name: outcome.englishName })} ${considered}`
    : considered;
}

/** What to tell the viewer about an AI review, in their words. */
function reviewMessage(
  t: ReturnType<typeof useTranslations<"settings.ingredients">>,
  name: string,
  outcome: ReviewOutcome
): string {
  switch (outcome.outcome) {
    case "merged":
      return t("aiOutcomes.merged", { name, into: outcome.into });
    case "parent":
      return t("aiOutcomes.parent", { name, of: outcome.of });
    case "distinct":
      return t("aiOutcomes.distinct", { name });
    case "unsure":
      return t("aiOutcomes.unsure", { name });
    case "not-flagged":
      return t("aiOutcomes.notFlagged", { name });
  }
}
