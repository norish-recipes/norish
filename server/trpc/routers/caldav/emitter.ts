import type { CaldavSubscriptionEvents } from "./types";

import { createTypedEmitter } from "../../emitter";

export const caldavEmitter = createTypedEmitter<CaldavSubscriptionEvents>();
