"use client";

import { createUseVersionQuery } from "@norish/shared-react/hooks";

export const useVersionQuery = createUseVersionQuery({
  getCurrentVersion: () => globalThis.process?.env?.NEXT_PUBLIC_APP_VERSION ?? "unknown",
});
