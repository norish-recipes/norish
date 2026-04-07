import { z } from "zod";

import { StoreSelectBaseSchema } from "@norish/shared/contracts/zod";

export const listStoresOutputSchema = z.array(StoreSelectBaseSchema);
export const createStoreOutputSchema = StoreSelectBaseSchema;
export const storeIdInputSchema = z.object({ storeId: z.uuid() });
