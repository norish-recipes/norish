import type { QueryKey } from "@tanstack/react-query";

import type {
  PantryIngredientDto,
  PantrySuggestionDto,
  StoreCreateDto,
  StoreDto,
  StoreSearchAddressResult,
  StoreUpdateInput,
} from "@norish/shared/contracts";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";

export type StoresData = StoreDto[];

export type StoresQueryResult = {
  stores: StoreDto[];
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setStoresData: (updater: (prev: StoresData | undefined) => StoresData | undefined) => void;
  invalidate: () => void;
};

export type StoreUpdateDraft = Omit<StoreUpdateInput, "version">;
export type StoreGrocerySnapshot = Array<{ id: string; version: number }>;

export type StoresMutationsResult = {
  createStore: (data: StoreCreateDto) => Promise<string>;
  updateStore: (data: StoreUpdateDraft) => void;
  deleteStore: (
    storeId: string,
    deleteGroceries: boolean,
    grocerySnapshot: StoreGrocerySnapshot
  ) => void;
  reorderStores: (storeIds: string[]) => void;
  checkSearchAddress: (
    storeId: string,
    term: string | null,
    searchAddress: string | null,
    website: string | null
  ) => Promise<StoreSearchAddressResult>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isReordering: boolean;
};

export type PantryData = PantryIngredientDto[];

export type PantryQueryResult = {
  items: PantryIngredientDto[];
  error: unknown;
  isLoading: boolean;
  /**
   * The Pantry could not be read and no earlier answer is cached: nothing is
   * known, which an empty `items` alone would misreport as nothing at home.
   */
  isUnavailable: boolean;
};

/** A food picked rather than typed: kept as picked, shown by its names until the server answers. */
export type PickedFood = {
  ingredientId: string;
  name: string;
  localeNames?: LocaleNames;
  ancestorIds?: string[];
};

export type PantrySuggestionsResult = {
  suggestions: PantrySuggestionDto[];
};

export type PantryMutationsResult = {
  /** Put a typed name or a picked food in the Pantry; resolves to the item's id. */
  addPantryIngredient: (food: string | PickedFood) => Promise<string>;
  /** Take an item out of the Pantry. */
  removePantryIngredient: (id: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
};
