import type { HouseholdSubscriptionEvents } from "./types";

import { createTypedEmitter } from "../../emitter";

export const householdEmitter = createTypedEmitter<HouseholdSubscriptionEvents>();
