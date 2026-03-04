import { createPermissionsHooks } from '@norish/shared-react/hooks';

import { useTRPC } from '@/providers/trpc-provider';

export const sharedPermissionsHooks = createPermissionsHooks({ useTRPC });
