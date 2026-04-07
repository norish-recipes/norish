import { useAuth } from "@/context/auth-context";
import { usePermissionsQuery } from "@/hooks/permissions";

import { createPermissionsContext } from "@norish/shared-react/contexts";

export type { PermissionsContextValue } from "@norish/shared-react/contexts";

const { PermissionsProvider, usePermissionsContext } = createPermissionsContext({
  useCurrentUserId: () => {
    const { user } = useAuth();
    return user?.id;
  },
  usePermissionsQuery,
});

export { PermissionsProvider, usePermissionsContext };
