"use client";

import { createUseVersionQuery } from "@norish/shared-react/hooks";

export const useVersionQuery = createUseVersionQuery({
  // NEXT_PUBLIC values are intentionally exposed to the browser by Next.js.
  // eslint-disable-next-line no-restricted-properties
  getCurrentVersion: () => process.env.NEXT_PUBLIC_APP_VERSION,
});
