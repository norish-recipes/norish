import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";

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
  canEdit: boolean;
  /** The viewer's spellings; the server keeps the other languages' until asked. */
  aliases: Spelling[];
  hiddenSpellings?: number;
}
