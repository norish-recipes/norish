import { useTRPC } from "@/providers/trpc-provider";

import { createConfigHooks } from "@norish/shared-react/hooks";

const sharedConfigHooks = createConfigHooks({ useTRPC });

export const useTagsQuery = sharedConfigHooks.useTagsQuery;
