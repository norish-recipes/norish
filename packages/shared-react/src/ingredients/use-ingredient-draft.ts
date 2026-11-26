"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cleanSpelling } from "@norish/shared/lib/spelling-keys";

import type { IngredientItem, NamedIngredient, Spelling, StoredIcon } from "./types";
import { useIngredientMutations } from "./use-ingredient-mutations";

/**
 * The icon as a food's draft holds it: unchanged (undefined), a stored file to make the food's
 * own, or the food's own removed (null).
 */
export type IconDraft = StoredIcon | null | undefined;

/** What an edit asks to pick another food for: a merge, a parent, or a spelling's move. */
export type Relocation =
  { kind: "merge" } | { kind: "parent" } | { kind: "move"; aliasId: string; text: string };

/** What a person picked: a known food, or a new one (`id` null). */
export type IngredientPick = { id: string; name: string } | { id: null };

/** The parent as the draft holds it: the food picked, or none. */
type DraftParent = NamedIngredient | null;

/**
 * One food's panel draft: fields are a draft until `save`; the actions (move, merge, delete) go
 * at once. `onGone` runs once the food no longer exists (merged away, deleted).
 */
export function useIngredientDraft(
  item: IngredientItem,
  /** The food's name as the reader sees it, which a merge toast and a merge's source carry. */
  displayName: string,
  onGone: () => void
) {
  const edits = useIngredientMutations();
  const [name, setName] = useState(item.name);
  const [parent, setParent] = useState<DraftParent>(item.parent);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  // Of `removed`, the spellings the viewer says name no food, for the junk pile.
  const [junk, setJunk] = useState<ReadonlySet<string>>(() => new Set());
  const [askingJunk, setAskingJunk] = useState<Spelling | null>(null);
  const [icon, setIcon] = useState<IconDraft>(undefined);
  const [alias, setAlias] = useState("");
  const [relocation, setRelocation] = useState<Relocation | null>(null);
  const hiddenSpellings = item.hiddenSpellings ?? 0;
  // What the row counts: every spelling the food has, and the draft's changes to them.
  const spellingCount = item.aliases.length + hiddenSpellings + added.length - removed.size;

  // A refused save is read back from the server, which would overwrite the
  // draft the viewer still has to fix: that one read leaves the draft alone.
  const keepDraftRef = useRef(false);

  // A change elsewhere (a housemate's, or AI's) shows in the draft where the
  // viewer has not touched that field.
  const takeSaved = useEffectEvent(() => {
    if (keepDraftRef.current) {
      keepDraftRef.current = false;

      return;
    }
    setName(item.name);
    setParent(item.parent);
  });
  const parentId = item.parent?.id ?? null;

  // Keyed on the saved values: the panel's own read brings the same parent as a new object.
  useEffect(() => takeSaved(), [item.name, parentId]);

  const nextName = name.trim();
  const nameChanged = nextName !== "" && nextName !== item.name;
  const parentChanged = (parent?.id ?? null) !== (item.parent?.id ?? null);
  const iconChanged = icon !== undefined;
  const dirty = nameChanged || parentChanged || iconChanged || added.length > 0 || removed.size > 0;

  /** Lands the draft as one edit the draft keeps if refused; resolves whether it went through. */
  const save = async (): Promise<boolean> => {
    if (!dirty) return true;
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

    return saved;
  };

  /** A spelling typed joins the draft clean, as it is stored; the field clears for the next. */
  const stageAlias = () => {
    const text = cleanSpelling(alias.trim());

    if (!text) return;
    if (!added.includes(text)) setAdded((current) => [...current, text]);
    setAlias("");
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

  /** What a pick means: a parent joins the draft, a move or a merge goes at once. */
  const saveRelocation = (asked: Relocation, target: IngredientPick) => {
    if (asked.kind === "parent") {
      if (target.id !== null) setParent({ id: target.id, name: target.name });
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
    onGone();
    void edits.merge({ id: item.id, name: displayName }, { id: targetId, name: target.name });
  };

  const remove = () => {
    onGone();
    void edits.remove(item.id);
  };

  // A removed own icon shows the placeholder until Save brings back what it falls back to.
  const icons = {
    shown: icon === undefined ? (item.icon ?? null) : (icon?.address ?? null),
    hasOwn: icon === undefined ? Boolean(item.ownIcon) : icon !== null,
    /** Removing the food's own icon is staged; one only staged is simply dropped. */
    remove: () => setIcon(item.ownIcon ? null : undefined),
  };

  return {
    name,
    setName,
    resetName: () => setName(item.name),
    parent,
    setParent,
    added,
    unstage: (text: string) => setAdded((current) => current.filter((it) => it !== text)),
    removed,
    toggleRemoval,
    askingJunk,
    askJunk: setAskingJunk,
    icon,
    setIcon,
    icons,
    alias,
    setAlias,
    stageAlias,
    spellingCount,
    hiddenSpellings,
    relocation,
    setRelocation,
    saveRelocation,
    dirty,
    save,
    remove,
    markDistinct: () => edits.markDistinct(item.id),
  };
}
