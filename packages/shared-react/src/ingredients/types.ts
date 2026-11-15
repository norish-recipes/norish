import type { AIChangeKind, FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames, NamedFood } from "@norish/shared/lib/ingredient-names";

/** One spelling of a food; `canRemove` is `edit` on the alias, which moving it needs too. */
export interface Spelling {
  id: string;
  text: string;
  locale?: string | null;
  seeded?: boolean;
  canRemove: boolean;
}

export interface IngredientItem {
  id: string;
  name: string;
  localeNames?: LocaleNames;
  flagged: boolean;
  flagReason?: FlagReason | null;
  parent: NamedIngredient | null;
  /** How many foods are kinds of this one. */
  kinds: number;
  /** The Ingredient Icon it shows, own, shipped or borrowed; null shows the placeholder. */
  icon?: string | null;
  /** Whether that icon is the food's own, the one a person may remove. */
  ownIcon?: boolean;
  canEdit: boolean;
  /** The viewer's spellings; the server keeps the other languages' until asked. */
  aliases: Spelling[];
  hiddenSpellings?: number;
}

/** One AI Change as Changed by AI lists it, saying whether the viewer may keep or undo it. */
export type AIChange = {
  id: string;
  kind: AIChangeKind;
  sure: boolean;
  kept: boolean;
  createdAt: Date;
  /** The food it is listed under: a merge's is the food the other joined; none for a deleted one. */
  ingredient: NamedFood | null;
  /** A parent's parent. */
  target: NamedFood | null;
  /** The parent a change to no parent took away. */
  dropped: NamedFood | null;
  /** The merged or deleted food's name, or the name AI replaced. */
  from: string | null;
  canAct: boolean;
};

/** A food as a row names it: a list's `NamedFood`, its translations where it has them. */
export type NamedIngredient = Pick<NamedFood, "id" | "name"> &
  Partial<Pick<NamedFood, "localeNames">>;

/** A drawn or uploaded icon, stored but not yet the food's: Save makes it so. */
export type StoredIcon = { file: string; address: string };

/**
 * An Ingredient's panel draft as Save sends it. Undefined leaves a field as it is; `parent` null
 * clears it, and `icon` null removes the food's own icon.
 */
export interface IngredientDraft {
  ingredientId: string;
  name?: string;
  parent?: NamedIngredient | null;
  add: string[];
  remove: string[];
  junk: string[];
  /** A stored file to make the food's own, with the address it shows at. */
  icon?: StoredIcon | null;
}
