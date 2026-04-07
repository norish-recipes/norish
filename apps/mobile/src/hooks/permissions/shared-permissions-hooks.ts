import { useTRPC } from "@/providers/trpc-provider";

import { createPermissionsHooks } from "@norish/shared-react/hooks";

export const sharedPermissionsHooks = createPermissionsHooks({ useTRPC });
