import type { SearchAddressOutcome, StoreColor, StoreDto } from "@norish/shared/contracts";
import { duplicateAisleName, foldAisleName, sortAisles } from "@norish/shared/lib/aisles";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { deriveSearchAddress } from "@norish/shared/lib/search-address";
import { storeColorKey } from "@norish/shared/lib/store-colors";

/** Aisle names are one to a hundred characters; the fields stop at the hundredth. */
export const AISLE_NAME_MAX = 100;

/** An aisle as it is being typed: a client-minted id (ADR-0003), a name, and the version a known one was read at. */
export interface EditingAisle {
  id: string;
  name: string;
  version?: number;
}

/** A Store as it is being typed: a new one where `id` is null. */
export interface EditingStore {
  id: string | null;
  name: string;
  color: StoreColor;
  /** What the user pasted: the shop's website, or a search they ran there. */
  link: string;
  /** The Store's aisles, in the order the household walks them. */
  aisles: EditingAisle[];
}

export function newEditingStore(): EditingStore {
  return { id: null, name: "", color: "primary", link: "", aisles: [] };
}

export function editingStoreOf(store: StoreDto): EditingStore {
  return {
    id: store.id,
    name: store.name,
    color: storeColorKey(store.color),
    link: store.searchAddress ?? store.website ?? "",
    aisles: sortAisles(store.aisles).map(({ id, name, version }) => ({ id, name, version })),
  };
}

/** A name, a link empty or readable (an unreadable one would save as none), and aisles each named once. */
export function canSaveStore(editing: EditingStore): boolean {
  const link = editing.link.trim();
  const aisleNames = editing.aisles.map((aisle) => aisle.name);

  return (
    editing.name.trim() !== "" &&
    (link === "" || deriveSearchAddress(link) !== null) &&
    aisleNames.every((name) => name.trim() !== "" && name.trim().length <= AISLE_NAME_MAX) &&
    duplicateAisleName(aisleNames) === null
  );
}

/** What a pasted link becomes: the shop's website, and its Search Address when the paste carried one. */
export function storeLinkFields(value: string): {
  website: string | null;
  searchAddress: string | null;
  /** The term the paste carried, which is what the shop is probed with. */
  term: string | null;
} {
  const derived = deriveSearchAddress(value);

  if (!derived) return { website: null, searchAddress: null, term: null };
  if (derived.kind === "website") {
    return { website: derived.website, searchAddress: null, term: null };
  }

  return { website: derived.website, searchAddress: derived.searchAddress, term: derived.term };
}

/** What a half-typed aisle name says about the list it would join. */
export function aisleDraftState(aisles: readonly EditingAisle[], draft: string) {
  const folded = foldAisleName(draft);
  const duplicate = folded !== "" && aisles.some((aisle) => foldAisleName(aisle.name) === folded);

  return {
    /** Whether there is a name to add and the Store has no aisle of it yet. */
    canAdd: folded !== "" && !duplicate,
    duplicate,
    // Two aisles renamed onto one name: said under the list, and Save waits.
    listDuplicate: duplicateAisleName(aisles.map((aisle) => aisle.name)) !== null,
  };
}

export function addedAisle(aisles: EditingAisle[], draft: string): EditingAisle[] {
  return aisleDraftState(aisles, draft).canAdd
    ? [...aisles, { id: createClientId(), name: draft.trim() }]
    : aisles;
}

export function renamedAisle(aisles: EditingAisle[], id: string, name: string): EditingAisle[] {
  return aisles.map((aisle) => (aisle.id === id ? { ...aisle, name } : aisle));
}

export function removedAisle(aisles: EditingAisle[], id: string): EditingAisle[] {
  return aisles.filter((aisle) => aisle.id !== id);
}

/** The words for each thing a shop can answer when its Search Address is tried, so no outcome goes unworded. */
export const SHOP_CHECK_MESSAGES: Record<SearchAddressOutcome, string> = {
  products: "checkFoundProducts",
  "no-products": "checkNoProducts",
  answered: "checkAnswered",
  "no-answer": "checkNoAnswer",
  "no-address": "checkNoAddress",
};
