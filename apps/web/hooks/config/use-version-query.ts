"use client";

import { createUseVersionQuery } from "@norish/shared-react/hooks";

import { env } from "~/env";

export const useVersionQuery = createUseVersionQuery({
  getCurrentVersion: () => env.NEXT_PUBLIC_APP_VERSION,
});
