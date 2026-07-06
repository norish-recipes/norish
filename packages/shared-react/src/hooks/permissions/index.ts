import type { CreatePermissionsHooksOptions } from "./types";
import { createUsePermissionsQuery } from "./use-permissions-query";
import { createUseServerSettingsQuery } from "./use-server-settings-query";

export type {
  CreatePermissionsHooksOptions,
  NormalizedPermissionsData,
  PermissionAccessInput,
  PermissionsData,
} from "./types";

export {
  checkPermissionAccess,
  normalizePermissionsData,
  selectCanDeleteRecipe,
  selectCanEditRecipe,
  selectCanViewRecipe,
  selectIsAutoTaggingEnabled,
} from "./selectors";
export { createUsePermissionsQuery } from "./use-permissions-query";
export { createUseServerSettingsQuery } from "./use-server-settings-query";

export function createPermissionsHooks(options: CreatePermissionsHooksOptions) {
  return {
    usePermissionsQuery: createUsePermissionsQuery(options),
    useServerSettingsQuery: createUseServerSettingsQuery(options),
  };
}
