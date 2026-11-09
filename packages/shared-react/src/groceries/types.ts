import type {
  GroceryDto,
  PantryIngredientDto,
  PantrySuggestionDto,
  RecurringGroceryDto,
  StoreCreateDto,
  StoreDto,
  StoreSearchAddressResult,
  StoreUpdateInput,
} from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";

export type RecipeInfo = {
  recipeId: string;
  recipeName: string;
};

export type RecipeMap = Record<string, RecipeInfo>;

export type GroceriesData = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
};

export type GroceriesQueryResult = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
  error: unknown;
  isLoading: boolean;
  getRecipeNameForGrocery: (grocery: GroceryDto) => string | null;
};

export type GroceryCreateData = {
  name: string;
  amount?: number | null;
  unit?: string | null;
  isDone?: boolean;
  recipeIngredientId?: string | null;
};

export type GroceriesMutationsResult = {
  createGrocery: (raw: string, storeId?: string | null, purchaseAmount?: number | null) => void;
  createGroceriesFromData: (groceries: GroceryCreateData[]) => Promise<string[]>;
  createRecurringGrocery: (
    raw: string,
    pattern: RecurrencePattern,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => void;
  toggleGroceries: (ids: string[], isDone: boolean) => void;
  toggleRecurringGrocery: (recurringGroceryId: string, groceryId: string, isDone: boolean) => void;
  updateGrocery: (
    id: string,
    raw: string,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => void;
  updateRecurringGrocery: (
    recurringGroceryId: string,
    groceryId: string,
    raw: string,
    pattern: RecurrencePattern | null,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => void;
  deleteGroceries: (ids: string[]) => void;
  deleteRecurringGrocery: (recurringGroceryId: string) => void;
  assignGroceryToStore: (
    groceryId: string,
    storeId: string | null,
    savePreference?: boolean
  ) => void;
  reorderGroceriesInStore: (
    updates: { id: string; sortOrder: number; storeId?: string | null }[]
  ) => void;
  markAllDoneInStore: (storeId: string | null) => void;
  deleteDoneInStore: (storeId: string | null) => void;
};

export type StoresData = StoreDto[];

export type StoresQueryResult = {
  stores: StoreDto[];
  error: unknown;
  isLoading: boolean;
};

export type StoreUpdateDraft = Omit<StoreUpdateInput, "version">;

export type StoresMutationsResult = {
  createStore: (data: StoreCreateDto) => Promise<string>;
  updateStore: (data: StoreUpdateDraft) => void;
  deleteStore: (storeId: string, deleteGroceries: boolean) => void;
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
