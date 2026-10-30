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
  parent: { id: string; name: string; localeNames?: LocaleNames } | null;
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
