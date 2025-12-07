import type { PermissionsSubscriptionEvents } from "./types";

import { createTypedEmitter } from "../../emitter";

export const permissionsEmitter = createTypedEmitter<PermissionsSubscriptionEvents>();
