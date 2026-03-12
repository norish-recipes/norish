import { createUserHooks } from '@norish/shared-react/hooks';

import { useTRPC } from '@/providers/trpc-provider';

const sharedUserHooks = createUserHooks({ useTRPC });

export const useUserAllergiesQuery = sharedUserHooks.useUserAllergiesQuery;
