"use client";

import { createUseVersionQuery } from "@norish/shared-react/hooks";

export const useVersionQuery = createUseVersionQuery({
  getCurrentVersion: () => process.env.NEXT_PUBLIC_APP_VERSION,
});
