import { createConfigHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedConfigHooks = createConfigHooks({ useTRPC });
