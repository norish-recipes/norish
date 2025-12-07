import type { GrocerySubscriptionEvents } from "./types";

import { createTypedEmitter } from "../../emitter";

export const groceryEmitter = createTypedEmitter<GrocerySubscriptionEvents>();
