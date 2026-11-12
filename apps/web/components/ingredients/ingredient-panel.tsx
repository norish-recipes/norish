"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OnTheListMark } from "@/components/ingredients/on-the-list-mark";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import UiSwitch from "@/components/shared/ui-switch";
import { useGroceriesPantryAndCatalogueSubscriptions } from "@/hooks/use-groceries-pantry-and-catalogue-subscriptions";
import { ArrowsRightLeftIcon, PencilSquareIcon } from "@heroicons/react/16/solid";
import { ArrowUturnLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button, Chip, Input, Skeleton, TextField } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { IngredientItem, NamedIngredient, Spelling } from "@norish/shared-react/ingredients";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { useOnTheList, usePantryItem, usePantryMutations } from "@norish/shared-react/groceries";
import {
  isOpenChange,
  useAIChangeMutations,
  useAIChangesQuery,
  useHeldIngredient,
  useIngredientMutations,
  useIngredientQuery,
  useIngredientSpellingsQuery,
  useIngredientUsesQuery,
} from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { cleanSpelling } from "@norish/shared/lib/spelling-keys";

import type { IconDraft } from "./ingredient-icon-field";
import type { IngredientPick } from "./ingredient-picker";
import type { Relocation } from "./ingredient-relocation";
import { AIChangeActions } from "./ai-change-actions";
import { DeleteIngredientModal } from "./delete-ingredient-modal";
import { IngredientIconField } from "./ingredient-icon-field";
import { IngredientNutritionSection } from "./ingredient-nutrition";
import { IngredientRelocationPanel } from "./ingredient-relocation";
import { IngredientStatusChip } from "./ingredient-status-chip";
import { JunkSpellingModal } from "./junk-spelling-modal";
import { changeMessage } from "./review-copy";

/** The parent as the draft holds it: the food picked, or none. */
type DraftParent = NamedIngredient | null;

/** One Ingredient's panel: fields are a draft until Save; actions patch the cache at once. */
export function IngredientPanel({
  id = null,
  item,
  open,
  nested = false,
  onClose,
}: {
  /** The food the panel is open for, which a link may name before the list lists it. */
  id?: string | null;
  /** The food as the list now has it; null while the list does not list it. */
  item: IngredientItem | null;
  open: boolean;
  /** Opened from another panel, over it: closing comes back to that one. */
  nested?: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  // The food asked for, else the last one, which stays while the panel slides away.
  const [lastId, setLastId] = useState(id ?? item?.id ?? null);
  const ownId = id ?? item?.id ?? lastId;

  if (ownId !== lastId) setLastId(ownId);
  if (ownId === null) return null;

  return (
    <>
      {open && item === null ? <IngredientRead ingredientId={ownId} locale={locale} /> : null}
      <IngredientPanelFrame
        ingredientId={ownId}
        item={item}
        nested={nested}
        open={open}
        onClose={onClose}
      />
    </>
  );
}

/** Reads a food the list does not list, mounted only while its panel is open. */
function IngredientRead({ ingredientId, locale }: { ingredientId: string; locale: string }) {
  useIngredientQuery(ingredientId, locale);

  return null;
}

/** The panel over the listed food, else the food's own read as the cache holds it. */
function IngredientPanelFrame({
  ingredientId,
  item,
  open,
  nested,
  onClose,
}: {
  ingredientId: string;
  item: IngredientItem | null;
  open: boolean;
  nested: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const held = useHeldIngredient(ingredientId, locale);
  const current = item ?? held;
  // The last food the panel had stays on screen while the panel slides away.
  const [shown, setShown] = useState<IngredientItem | null>(item);

  if (current && current !== shown) setShown(current);

  // Another food asked for, not read yet: nothing, rather than the last one.
  if (!shown || (open && shown.id !== ingredientId && !current)) return null;

  return (
    <Panel
      // Another food is another panel: its fields start from that food.
      key={shown.id}
      nested={nested}
      open={open}
      title={ingredientDisplayName(shown, locale)}
      titleAddon={<IngredientStatusChip flagged={shown.flagged} />}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <IngredientPanelContent item={shown} onClose={onClose} />
    </Panel>
  );
}

/** The panel's content, mounted while it is open: each opening is a fresh draft. */
function IngredientPanelContent({ item, onClose }: { item: IngredientItem; onClose: () => void }) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const locale = useLocale();
  const edits = useIngredientMutations();
  const displayName = ingredientDisplayName(item, locale);

  useGroceriesPantryAndCatalogueSubscriptions();
  const [allSpellings, setAllSpellings] = useState(false);
  // The server sends the viewer's and the household's spellings; the rest are read once asked for.
  const hiddenSpellings = item.hiddenSpellings ?? 0;

  // The draft: what the viewer has changed and not yet saved.
  const [name, setName] = useState(item.name);
  const [parent, setParent] = useState<DraftParent>(item.parent);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  // Of `removed`, the spellings the viewer says name no food, for the junk pile.
  const [junk, setJunk] = useState<ReadonlySet<string>>(() => new Set());
  const [askingJunk, setAskingJunk] = useState<Spelling | null>(null);
  const [icon, setIcon] = useState<IconDraft>(undefined);
  // What the row counts: every spelling the food has, and the draft's changes to them.
  const spellingCount = item.aliases.length + hiddenSpellings + added.length - removed.size;
  const [alias, setAlias] = useState("");
  const [relocation, setRelocation] = useState<Relocation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showingUses, setShowingUses] = useState(false);
  const aiChanges = useAIChangeMutations();
  // What AI changed about this food without being sure: what its flag is for.
  const unsure = useAIChangesQuery((changes) =>
    changes.filter((change) => change.ingredient?.id === item.id && isOpenChange(change))
  );

  // Whether the household keeps the food, and the draft's say on it (null: untouched).
  const tGroceries = useTranslations("groceries.page");
  const kept = usePantryItem(item.id);
  const { addPantryIngredient, removePantryIngredient } = usePantryMutations();
  const [keeps, setKeeps] = useState<boolean | null>(null);

  // A refused save is read back from the server, which would overwrite the
  // draft the viewer still has to fix: that one read leaves the draft alone.
  const keepDraftRef = useRef(false);

  // A change elsewhere (a housemate's, or AI's) shows in the draft where the
  // viewer has not touched that field.
  useEffect(() => {
    if (keepDraftRef.current) {
      keepDraftRef.current = false;

      return;
    }
    setName(item.name);
    setParent(item.parent);
  }, [item.name, item.parent]);

  const nextName = name.trim();
  const nameChanged = nextName !== "" && nextName !== item.name;
  const parentChanged = (parent?.id ?? null) !== (item.parent?.id ?? null);
  const iconChanged = icon !== undefined;
  const catalogueDirty =
    nameChanged || parentChanged || iconChanged || added.length > 0 || removed.size > 0;
  const pantryChanged = keeps !== null && keeps !== (kept !== null);
  const dirty = catalogueDirty || pantryChanged;

  /** Lands the Pantry switch, and the catalogue fields as one edit the draft keeps if refused. */
  const save = async () => {
    if (!dirty) return;
    if (pantryChanged) {
      if (kept) removePantryIngredient(kept.id);
      else
        void addPantryIngredient(
          { ingredientId: item.id, name: item.name, localeNames: item.localeNames },
          displayName
        );
      setKeeps(null);
    }
    if (!catalogueDirty) return;
    const draft = { added, removed, junk, parent, icon };

    // The row reads as the draft has it, and the draft is spent, at once.
    setAdded([]);
    setRemoved(new Set());
    setJunk(new Set());
    setIcon(undefined);
    const saved = await edits.saveDraft({
      ingredientId: item.id,
      ...(nameChanged ? { name: nextName } : {}),
      ...(parentChanged ? { parent } : {}),
      add: added,
      remove: [...removed],
      junk: [...junk],
      ...(iconChanged ? { icon } : {}),
    });

    // A refused draft is the viewer's to fix, so it comes back as it was.
    if (!saved) {
      keepDraftRef.current = true;
      setAdded(draft.added);
      setRemoved(draft.removed);
      setJunk(draft.junk);
      setName(nextName);
      setParent(draft.parent);
      setIcon(draft.icon);
    }
  };

  /** A spelling typed joins the draft clean, as it is stored; the field clears for the next. */
  const stageAlias = () => {
    const text = cleanSpelling(alias.trim());

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
      void edits.moveAlias(item.id, asked.aliasId, targetId);

      return;
    }
    if (targetId === null) return;
    // Merged away, the food is gone: nothing is left to show for it.
    onClose();
    void edits.merge({ id: item.id, name: displayName }, { id: targetId, name: target.name });
  };

  const confirmDelete = () => {
    setDeleting(false);
    onClose();
    void edits.remove(item.id);
  };

  /** Stage a spelling's removal, onto the junk pile when `asJunk`; staged again, it is kept. */
  const toggleRemoval = (spelling: Spelling, asJunk = false) => {
    const pending = removed.has(spelling.id);
    const toggled = (current: ReadonlySet<string>, on: boolean) => {
      const next = new Set(current);

      if (on) next.add(spelling.id);
      else next.delete(spelling.id);

      return next;
    };

    setRemoved((current) => toggled(current, !pending));
    setJunk((current) => toggled(current, !pending && asJunk));
  };

  /**
   * One spelling the food goes by; one the viewer may edit is a button moving it to another food,
   * and its cross asks whether it names no food before removing it (folds are unique).
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
            type="button"
            onClick={() => (pendingRemoval ? toggleRemoval(spelling) : setAskingJunk(spelling))}
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
    <>
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="ingredient-details">
          {unsure.length > 0 ? (
            <Section title={t("changedByAI.unsure")}>
              <div className="flex flex-col gap-3" data-testid="ingredient-ai-changes">
                {unsure.map((change) => (
                  <div
                    key={change.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                    data-kind={change.kind}
                    data-testid="ingredient-ai-change"
                  >
                    <p className="text-sm font-medium">{changeMessage(t, change, locale)}</p>
                    <AIChangeActions
                      change={change}
                      onKeep={(it) => void aiChanges.keep(it)}
                      onUndo={(it) => void aiChanges.undo(it)}
                    />
                  </div>
                ))}
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
                  <Button
                    data-testid="ingredient-mark-distinct"
                    size="sm"
                    variant="secondary"
                    onPress={() => void edits.markDistinct(item.id)}
                  >
                    <ArrowsRightLeftIcon className="size-4" />
                    {t("markDistinct")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <Section title={t("nameSection")}>
            <div className="flex items-center gap-3">
              <IngredientIconField draft={icon} item={item} onDraftChange={setIcon} />
              {item.canEdit ? (
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
                      if (event.key === "Enter") void save();
                      if (event.key === "Escape") setName(item.name);
                    }}
                  />
                </TextField>
              ) : (
                <p className="font-medium">{item.name}</p>
              )}
            </div>
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
                <Chip className="h-9 px-3 text-sm md:h-8" size="lg" variant="secondary">
                  {ingredientDisplayName(parent, locale)}
                  {item.canEdit ? (
                    <button
                      aria-label={t("clearParent")}
                      className="text-muted hover:text-foreground ml-1 cursor-[var(--cursor-interactive)]"
                      data-testid="ingredient-clear-parent"
                      type="button"
                      onClick={() => setParent(null)}
                    >
                      <XMarkIcon className="size-4" />
                    </button>
                  ) : null}
                </Chip>
              ) : null}
              {item.canEdit ? (
                <Button
                  data-testid="ingredient-set-parent"
                  size="sm"
                  variant="secondary"
                  onPress={() => setRelocation({ kind: "parent" })}
                >
                  <PencilSquareIcon className="size-4" />
                  {parent ? t("changeParent") : t("setParent")}
                </Button>
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
        <ActionButtonGroup
          start={
            item.canEdit ? (
              <ActionButton
                action="delete"
                data-testid="ingredient-delete"
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
              data-testid="ingredient-merge"
              onPress={() => setRelocation({ kind: "merge" })}
            >
              {t("merge")}
            </ActionButton>
          ) : null}
          <ActionButton
            action="save"
            data-testid="ingredient-save"
            isDisabled={!dirty}
            onPress={() => void save()}
          >
            {tActions("save")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>

      <Panel
        nested
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
              {hiddenSpellings > 0 ? (
                <HeldBackSpellings
                  aliases={item.aliases}
                  chip={spellingChip}
                  ingredientId={item.id}
                />
              ) : (
                item.aliases.map(spellingChip)
              )}
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
                isDisabled={!alias.trim()}
                label={t("addAlias")}
                variant="tertiary"
                onPress={stageAlias}
              />
            </div>
          </div>
        </Panel.Body>
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="done" onPress={() => setAllSpellings(false)}>
              {tActions("done")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      </Panel>

      <IngredientRelocationPanel
        ingredient={item}
        relocation={relocation}
        onClose={() => setRelocation(null)}
        onConfirm={saveRelocation}
      />

      <JunkSpellingModal
        alias={askingJunk?.text ?? null}
        onClose={() => setAskingJunk(null)}
        onRemove={(asJunk) => {
          if (askingJunk) toggleRemoval(askingJunk, asJunk);
          setAskingJunk(null);
        }}
      />

      <DeleteIngredientModal
        ingredientId={item.id}
        isOpen={deleting}
        name={displayName}
        onClose={() => setDeleting(false)}
        onConfirm={confirmDelete}
        onShowUses={() => {
          setDeleting(false);
          setShowingUses(true);
        }}
      />

      <IngredientUsesPanel
        ingredientId={item.id}
        name={displayName}
        open={showingUses}
        onClose={() => setShowingUses(false)}
      />
    </>
  );
}

/** Whether the household keeps this food itself: a draft switch any member may set. */
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
  const onTheList = useOnTheList(kept ? [kept] : []).length > 0;

  return (
    <div
      className="flex min-h-9 flex-wrap items-center justify-between gap-3"
      data-testid="ingredient-pantry"
    >
      <UiSwitch isSelected={keeping} onValueChange={onKeepingChange}>
        <span className="text-sm">{t("inYourPantry")}</span>
      </UiSwitch>
      {kept && keeping && onTheList ? <OnTheListMark /> : null}
    </div>
  );
}

/**
 * What still uses a food, as far as the viewer may see: the recipes they can
 * open, the household's groceries and Pantry, and a count of everything else.
 */
function IngredientUsesPanel({
  ingredientId,
  name,
  open,
  onClose,
}: {
  ingredientId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.ingredients.uses");

  return (
    <Panel
      nested
      open={open}
      title={t("title", { name })}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <IngredientUsesContent ingredientId={ingredientId} onClose={onClose} />
    </Panel>
  );
}

/** The uses panel's content, mounted while it is open, so the uses are read only then. */
function IngredientUsesContent({
  ingredientId,
  onClose,
}: {
  ingredientId: string;
  onClose: () => void;
}) {
  const t = useTranslations("settings.ingredients.uses");
  const tActions = useTranslations("common.actions");
  const { uses: data } = useIngredientUsesQuery(ingredientId);
  const unused =
    data &&
    data.recipes.length === 0 &&
    data.groceries.length === 0 &&
    !data.pantry &&
    data.elsewhere === 0;

  return (
    <>
      <Panel.Body>
        <div className="flex flex-col gap-5 pb-2" data-testid="ingredient-uses">
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
          {data && data.groceries.length > 0 ? (
            <Section title={t("groceries")}>
              <ul className="flex flex-col gap-1 text-sm">
                {data.groceries.map((grocery) => (
                  <li key={grocery.id}>
                    {grocery.name}
                    {grocery.done || grocery.recurring ? (
                      <span className="text-muted">
                        {" · "}
                        {grocery.recurring ? t("repeats") : t("done")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {data?.pantry ? <p className="text-sm">{t("pantry")}</p> : null}
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
    </>
  );
}

/** Every spelling the food goes by, read once the panel showing them opens. */
function HeldBackSpellings({
  ingredientId,
  aliases,
  chip,
}: {
  ingredientId: string;
  aliases: Spelling[];
  chip: (spelling: Spelling) => ReactNode;
}) {
  return (useIngredientSpellingsQuery(ingredientId) ?? aliases).map(chip);
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
