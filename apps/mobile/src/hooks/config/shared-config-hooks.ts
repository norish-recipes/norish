import { createConfigHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/providers/trpc-provider";

export const sharedConfigHooks = createConfigHooks({ useTRPC });
