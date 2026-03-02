import type { StoreDto } from "@norish/shared/contracts";

export type StoreSubscriptionEvents = {
  created: { store: StoreDto };
  updated: { store: StoreDto };
  deleted: { storeId: string; deletedGroceryIds: string[] };
  reordered: { stores: StoreDto[] };
};
