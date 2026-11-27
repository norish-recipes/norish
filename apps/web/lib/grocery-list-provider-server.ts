import "server-only";

import { cache } from "react";
import { serverPackage } from "@/lib/server-package";

const { getGroceryListProvider } = await serverPackage<
  typeof import("@norish/shared-server/config/server-config-loader")
>("@norish/shared-server/config/server-config-loader");

/** Where this instance's shopping list lives, read once per request: a layout and a page share it. */
export const readGroceryListProvider = cache(() => getGroceryListProvider());
