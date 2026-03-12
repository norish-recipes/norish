import { createConfigHooks } from '@norish/shared-react/hooks';

import { useTRPC } from '@/providers/trpc-provider';

const sharedConfigHooks = createConfigHooks({ useTRPC });

export const useTimerKeywordsQuery = sharedConfigHooks.useTimerKeywordsQuery;
